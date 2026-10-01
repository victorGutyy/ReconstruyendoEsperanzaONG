"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/lib/auth/guard";
import { ImageRejectedError, processImage } from "@/lib/images/process";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { supabasePrivateStorage } from "@/lib/storage/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { type MediaFormState, parseLibraryFilters, updateMediaSchema } from "./library";
import { syncPublicMediaAfter } from "./publishing";
import { type LibraryItem, listLibrary } from "./queries";
import {
  mediaIdSchema,
  mediaPaths,
  rejectionMessage,
  requestUploadSchema,
  type RequestUploadResult,
  type UploadResult,
} from "./schema";

const MEDIA_PATH = "/admin/medios";

/**
 * Step 1 of an upload (docs/04 §5.3): checks permission, MFA and the hourly
 * limit, creates the photo row as the signed-in user (audited with them as
 * actor) and returns a one-file upload URL for the private incoming bucket.
 */
export async function requestUpload(input: {
  type: string;
  size: number;
}): Promise<RequestUploadResult> {
  const authorized = await authorizeAction("media.upload");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  const parsed = requestUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Solo se aceptan fotos JPEG, PNG o WebP de hasta 15 MB." };
  }

  const attempt = await getRateLimiter().limit(
    RATE_LIMITS.mediaUploads,
    rateLimitKey(authorized.auth.user.id),
  );
  if (!attempt.success) {
    return { ok: false, error: "Subiste muchas fotos en la última hora. Espera un rato." };
  }

  // RLS: media.upload + MFA; the trigger sets uploaded_by to this user
  const supabase = await createClient();
  const { data, error } = await supabase.from("media").insert({}).select("id").single();
  if (error) return { ok: false, error: "No se pudo preparar la subida." };

  try {
    const upload = await supabasePrivateStorage().createUploadUrl(
      "media-incoming",
      mediaPaths.incoming(data.id),
    );
    return { ok: true, mediaId: data.id, signedUrl: upload.signedUrl };
  } catch {
    await markFailed(data.id);
    return { ok: false, error: "No se pudo preparar la subida." };
  }
}

/** Technical columns are written only by the server (docs/06 §6). */
async function markFailed(mediaId: string) {
  await createAdminClient()
    .from("media")
    .update({ processing_status: "failed" })
    .eq("id", mediaId)
    .eq("processing_status", "processing");
}

/**
 * Step 2, after the browser uploaded the file: re-encodes it with sharp (no
 * EXIF/GPS), stores three WebP sizes privately and deletes the original.
 * Only the person who uploaded the photo can finish it.
 */
export async function finishUpload(mediaId: string): Promise<UploadResult> {
  const authorized = await authorizeAction("media.upload");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  const id = mediaIdSchema.safeParse(mediaId);
  if (!id.success) return { ok: false, error: "Foto no válida." };

  const supabase = await createClient();
  const { data: media } = await supabase
    .from("media")
    .select("id, uploaded_by, processing_status")
    .eq("id", id.data)
    .maybeSingle();
  if (
    !media ||
    media.uploaded_by !== authorized.auth.user.id ||
    media.processing_status !== "processing"
  ) {
    return { ok: false, error: "No se encontró la foto." };
  }

  const storage = supabasePrivateStorage();
  const incoming = mediaPaths.incoming(media.id);

  try {
    const original = await storage.download("media-incoming", incoming);
    if (!original) {
      await markFailed(media.id);
      return { ok: false, error: "No recibimos la foto. Vuelve a intentarlo." };
    }

    const variants = await processImage(original);
    for (const variant of variants) {
      await storage.upload(
        "media-private",
        mediaPaths.variant(media.id, variant.size),
        variant.data,
        "image/webp",
      );
    }

    const largest = variants.reduce((a, b) => (b.width > a.width ? b : a));
    const { error } = await createAdminClient()
      .from("media")
      .update({
        processing_status: "ready",
        private_path: mediaPaths.folder(media.id),
        mime_type: "image/webp",
        width: largest.width,
        height: largest.height,
        bytes: variants.reduce((total, variant) => total + variant.bytes, 0),
      })
      .eq("id", media.id);
    if (error) throw error;

    revalidateMedia();
    return { ok: true };
  } catch (error) {
    await markFailed(media.id);
    return {
      ok: false,
      error:
        error instanceof ImageRejectedError
          ? rejectionMessage(error.reason)
          : "No se pudo procesar la foto. Vuelve a intentarlo.",
    };
  } finally {
    // The original (with its GPS) is never kept, whatever happened
    await storage.remove("media-incoming", [incoming]).catch(() => undefined);
  }
}

/**
 * "Quitar" for an upload that failed or never finished: it goes to the trash
 * (RLS: the uploader or media.update) and its files are deleted.
 */
export async function discardUpload(mediaId: string): Promise<UploadResult> {
  const authorized = await authorizeAction("media.upload");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  const id = mediaIdSchema.safeParse(mediaId);
  if (!id.success) return { ok: false, error: "Foto no válida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id.data)
    .neq("processing_status", "ready")
    .is("deleted_at", null)
    .select("id");
  if (error || data.length === 0) return { ok: false, error: "No se pudo quitar la foto." };

  await supabasePrivateStorage()
    .remove("media-incoming", [mediaPaths.incoming(id.data)])
    .catch(() => undefined);

  revalidateMedia();
  return { ok: true };
}

/** Library and photo pages both depend on the photo rows. */
function revalidateMedia() {
  revalidatePath(MEDIA_PATH, "layout");
}

async function limitPanelAction(userId: string): Promise<string | null> {
  const attempt = await getRateLimiter().limit(RATE_LIMITS.panelActions, rateLimitKey(userId));
  return attempt.success ? null : "Demasiadas acciones seguidas. Espera un momento.";
}

/**
 * Saves the descriptive fields of a photo. RLS lets the uploader or media.update
 * write them (docs/06 §10); for anyone else no row changes and we say so.
 */
export async function updateMedia(
  _prev: MediaFormState,
  formData: FormData,
): Promise<MediaFormState> {
  const authorized = await authorizeAction("media.upload");
  if (!authorized.ok) return { error: authorized.error };

  const parsed = updateMediaSchema.safeParse({
    id: formData.get("id"),
    altText: formData.get("altText") ?? "",
    caption: formData.get("caption") ?? "",
    credit: formData.get("credit") ?? "",
    people: formData.get("people"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const limited = await limitPanelAction(authorized.auth.user.id);
  if (limited) return { error: limited };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .update({
      alt_text: parsed.data.altText,
      caption: parsed.data.caption,
      credit: parsed.data.credit,
      people_in_photo: parsed.data.people,
    })
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { error: "No se pudieron guardar los cambios." };
  if (data.length === 0) return { error: "No tienes permiso para editar esta foto." };

  // A photo without description or newly with people may have to leave the site
  await syncPublicMediaAfter([parsed.data.id]);
  revalidateMedia();
  return { notice: "Cambios guardados." };
}

/** Soft delete: the files stay until the trash is emptied (F7, trash.purge). */
export async function trashMedia(
  _prev: MediaFormState,
  formData: FormData,
): Promise<MediaFormState> {
  const authorized = await authorizeAction("media.upload");
  if (!authorized.ok) return { error: authorized.error };

  const id = mediaIdSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: "Foto no válida." };

  const limited = await limitPanelAction(authorized.auth.user.id);
  if (limited) return { error: limited };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id.data)
    .is("deleted_at", null)
    .select("id");
  if (error) return { error: "No se pudo enviar a la papelera." };
  if (data.length === 0) return { error: "No tienes permiso para enviar esta foto a la papelera." };

  await syncPublicMediaAfter([id.data]);
  revalidateMedia();
  return { notice: "Foto enviada a la papelera." };
}

/**
 * Only the description of a photo (used inline while publishing an
 * activity). RLS: the uploader or media.update.
 */
export async function updateMediaDescription(
  mediaId: string,
  altText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authorized = await authorizeAction("media.upload");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  const parsed = updateMediaSchema
    .pick({ id: true, altText: true })
    .safeParse({ id: mediaId, altText });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa la descripción." };
  }

  const limited = await limitPanelAction(authorized.auth.user.id);
  if (limited) return { ok: false, error: limited };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .update({ alt_text: parsed.data.altText })
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: "No se pudo guardar la descripción." };
  if (data.length === 0) return { ok: false, error: "No tienes permiso para editar esta foto." };

  await syncPublicMediaAfter([parsed.data.id]);
  revalidateMedia();
  return { ok: true };
}

/** Whether each photo appears in people's photos (step 3 of publishing, 7.3b). */
export async function updateMediaPeople(
  mediaId: string,
  people: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authorized = await authorizeAction("media.upload");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  const parsed = updateMediaSchema
    .pick({ id: true, people: true })
    .safeParse({ id: mediaId, people });
  if (!parsed.success) return { ok: false, error: "Elige una opción válida." };

  const limited = await limitPanelAction(authorized.auth.user.id);
  if (limited) return { ok: false, error: limited };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .update({ people_in_photo: parsed.data.people })
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: "No se pudo guardar." };
  if (data.length === 0) return { ok: false, error: "No tienes permiso para editar esta foto." };

  await syncPublicMediaAfter([parsed.data.id]);
  revalidateMedia();
  return { ok: true };
}

export type PickerPage =
  { ok: true; items: LibraryItem[]; pageCount: number } | { ok: false; error: string };

/**
 * A page of the library for choosing photos from another section (e.g. an
 * activity). Same rules as Medios: media.upload, no trash.
 */
export async function browseLibrary(input: { mine: boolean; page: number }): Promise<PickerPage> {
  const authorized = await authorizeAction("media.upload");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  const filters = parseLibraryFilters({
    mine: input.mine ? "1" : undefined,
    page: String(input.page),
  });
  try {
    const page = await listLibrary(filters, authorized.auth.user.id, false);
    return { ok: true, items: page.items, pageCount: page.pageCount };
  } catch {
    return { ok: false, error: "No se pudo cargar la biblioteca." };
  }
}
