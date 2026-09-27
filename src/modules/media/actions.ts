"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/lib/auth/guard";
import { ImageRejectedError, processImage } from "@/lib/images/process";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { supabasePrivateStorage } from "@/lib/storage/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

    revalidatePath(MEDIA_PATH);
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

  revalidatePath(MEDIA_PATH);
  return { ok: true };
}
