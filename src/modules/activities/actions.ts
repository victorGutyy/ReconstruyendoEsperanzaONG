"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/guard";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { slugify, uniqueSlug } from "@/lib/utils/slug";

import { type ActivityStatus, getActivityForWizard, getPhotosWithIssues } from "./queries";
import { reviewActivity } from "./review";
import {
  type BasicsInput,
  basicsSchema,
  optionalNoteSchema,
  type PhotoResult,
  reviewNoteSchema,
  type SaveResult,
  toBogotaInstant,
} from "./schema";

const ACTIVITIES_PATH = "/admin/actividades";
const SLUG_BASE_MAX = 110;
const UNIQUE_VIOLATION = "23505";
const FORBIDDEN = "42501";
const idSchema = z.uuid();

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function limited(userId: string): Promise<string | null> {
  const attempt = await getRateLimiter().limit(RATE_LIMITS.panelActions, rateLimitKey(userId));
  return attempt.success ? null : "Demasiadas acciones seguidas. Espera un momento.";
}

/** A free slug for the title among activities not in the trash (except `exceptId`). */
async function freeSlug(supabase: Supabase, title: string, exceptId?: string): Promise<string> {
  const base = slugify(title, SLUG_BASE_MAX) || "actividad";
  let query = supabase
    .from("activities")
    .select("slug")
    .like("slug", `${base}%`)
    .is("deleted_at", null);
  if (exceptId) query = query.neq("id", exceptId);
  const { data } = await query;
  return uniqueSlug(base, new Set((data ?? []).map((row) => row.slug)));
}

/**
 * Step 1 (create or update). Also used by the autosave. Place and category
 * may be empty in a draft; RN-A-02 is checked when publishing.
 */
export async function saveActivityBasics(input: {
  id?: string;
  fields: BasicsInput;
}): Promise<SaveResult> {
  const authorized = await authorizeAction(input.id ? "content.read" : "content.create");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  const parsed = basicsSchema.safeParse(input.fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  const supabase = await createClient();

  if (!input.id) {
    // Two tries: another activity could take the same slug in between
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const slug = await freeSlug(supabase, parsed.data.title);
      const { data, error } = await supabase
        .from("activities")
        .insert({ ...parsed.data, slug })
        .select("id, updated_at")
        .single();
      if (!error && data) {
        revalidatePath(ACTIVITIES_PATH, "layout");
        return { ok: true, id: data.id, savedAt: data.updated_at };
      }
      if (error?.code !== UNIQUE_VIOLATION) break;
    }
    return { ok: false, error: "No se pudo crear la actividad." };
  }

  const { data: current } = await supabase
    .from("activities")
    .select("title, published_at")
    .eq("id", input.id)
    .maybeSingle();
  if (!current) return { ok: false, error: "No se encontró la actividad." };

  // The slug follows the title until the activity is published (then it is frozen)
  const slug =
    current.published_at === null && current.title !== parsed.data.title
      ? await freeSlug(supabase, parsed.data.title, input.id)
      : undefined;

  const { data, error } = await supabase
    .from("activities")
    .update({ ...parsed.data, ...(slug ? { slug } : {}) })
    .eq("id", input.id)
    .is("deleted_at", null)
    .select("id, updated_at");
  if (error) {
    return {
      ok: false,
      error:
        error.code === FORBIDDEN
          ? "No tienes permiso para editar esta actividad."
          : "No se pudieron guardar los cambios.",
    };
  }
  if (data.length === 0) {
    return { ok: false, error: "No puedes editar esta actividad (ya fue publicada o no es tuya)." };
  }

  revalidatePath(ACTIVITIES_PATH, "layout");
  return { ok: true, id: data[0]!.id, savedAt: data[0]!.updated_at };
}

async function photoContext() {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { error: authorized.error } as const;
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { error: tooMany } as const;
  return { supabase: await createClient() } as const;
}

const photoError = (code?: string) =>
  code === "23514"
    ? "Esa foto no se puede usar en una actividad publicada: revisa su descripción y autorizaciones."
    : code === FORBIDDEN
      ? "No tienes permiso para cambiar las fotos de esta actividad."
      : "No se pudo actualizar la foto.";

/** Attaches an uploaded photo at the end; the first photo becomes the cover. */
export async function attachPhoto(activityId: string, mediaId: string): Promise<PhotoResult> {
  const context = await photoContext();
  if ("error" in context) return { ok: false, error: context.error ?? "Sin permiso." };
  const { supabase } = context;

  const { data: activity } = await supabase
    .from("activities")
    .select("cover_media_id, activity_media(position)")
    .eq("id", activityId)
    .maybeSingle();
  if (!activity) return { ok: false, error: "No se encontró la actividad." };

  const last = Math.max(0, ...activity.activity_media.map((link) => link.position));
  const { error } = await supabase
    .from("activity_media")
    .insert({ activity_id: activityId, media_id: mediaId, position: last + 1 });
  if (error) return { ok: false, error: photoError(error.code) };

  if (!activity.cover_media_id) {
    await supabase.from("activities").update({ cover_media_id: mediaId }).eq("id", activityId);
  }
  revalidatePath(ACTIVITIES_PATH, "layout");
  return { ok: true };
}

/** ★ Portada: any photo of the activity. */
export async function setCover(activityId: string, mediaId: string): Promise<PhotoResult> {
  const context = await photoContext();
  if ("error" in context) return { ok: false, error: context.error ?? "Sin permiso." };
  const { supabase } = context;

  const { data: link } = await supabase
    .from("activity_media")
    .select("id")
    .eq("activity_id", activityId)
    .eq("media_id", mediaId)
    .maybeSingle();
  if (!link) return { ok: false, error: "La foto no pertenece a esta actividad." };

  const { data, error } = await supabase
    .from("activities")
    .update({ cover_media_id: mediaId })
    .eq("id", activityId)
    .select("id");
  if (error || data.length === 0) return { ok: false, error: photoError(error?.code) };
  revalidatePath(ACTIVITIES_PATH, "layout");
  return { ok: true };
}

/** Moves a photo one place, renumbering the photos 1…n. */
export async function movePhoto(
  activityId: string,
  mediaId: string,
  direction: "up" | "down",
): Promise<PhotoResult> {
  const context = await photoContext();
  if ("error" in context) return { ok: false, error: context.error ?? "Sin permiso." };
  const { supabase } = context;

  const { data: links } = await supabase
    .from("activity_media")
    .select("id, media_id, position")
    .eq("activity_id", activityId)
    .order("position");
  if (!links) return { ok: false, error: "No se encontró la actividad." };

  const from = links.findIndex((link) => link.media_id === mediaId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= links.length) return { ok: true };
  [links[from], links[to]] = [links[to]!, links[from]!];

  for (const [index, link] of links.entries()) {
    if (link.position === index + 1) continue;
    const { error } = await supabase
      .from("activity_media")
      .update({ position: index + 1 })
      .eq("id", link.id);
    if (error) return { ok: false, error: photoError(error.code) };
  }
  revalidatePath(ACTIVITIES_PATH, "layout");
  return { ok: true };
}

/** Removes a photo from the activity (it stays in the library). */
export async function detachPhoto(activityId: string, mediaId: string): Promise<PhotoResult> {
  const context = await photoContext();
  if ("error" in context) return { ok: false, error: context.error ?? "Sin permiso." };
  const { supabase } = context;

  const { data: activity } = await supabase
    .from("activities")
    .select("cover_media_id, activity_media(media_id, position)")
    .eq("id", activityId)
    .maybeSingle();
  if (!activity) return { ok: false, error: "No se encontró la actividad." };

  const { data, error } = await supabase
    .from("activity_media")
    .delete()
    .eq("activity_id", activityId)
    .eq("media_id", mediaId)
    .select("id");
  if (error || data.length === 0) return { ok: false, error: photoError(error?.code) };

  if (activity.cover_media_id === mediaId) {
    const next = activity.activity_media
      .filter((link) => link.media_id !== mediaId)
      .sort((a, b) => a.position - b.position)[0];
    await supabase
      .from("activities")
      .update({ cover_media_id: next?.media_id ?? null })
      .eq("id", activityId);
  }
  revalidatePath(ACTIVITIES_PATH, "layout");
  return { ok: true };
}

export type PublishOutcome = "review" | "published" | "scheduled";
export type PublishResult = { ok: true; outcome: PublishOutcome } | { ok: false; error: string };

/** The database names the photo that failed (docs/06 §6): say which one. */
function publishError(
  error: { code?: string; message?: string; details?: string },
  labels: Map<string, string>,
): string {
  if (error.code === FORBIDDEN) return "No tienes permiso para hacer esto.";
  if (error.message?.includes("media_not_publishable")) {
    const mediaId = error.details?.split(":")[0] ?? "";
    return `${labels.get(mediaId) ?? "Una foto"} no se puede publicar todavía: revisa su descripción, las personas y sus autorizaciones.`;
  }
  if (error.message?.includes("activities_published_complete")) {
    return "Faltan el lugar general o la categoría.";
  }
  return "No se pudo publicar. Vuelve a intentarlo.";
}

async function loadReview(activityId: string, publisher: boolean) {
  const activity = await getActivityForWizard(activityId);
  if (!activity || activity.inTrash) return null;
  const photos = await getPhotosWithIssues(activity);
  const review = reviewActivity(
    {
      placeId: activity.placeId,
      categoryId: activity.categoryId,
      photos: photos.map((photo) => ({
        mediaId: photo.mediaId,
        label: photo.label,
        processing: photo.processingStatus !== "ready",
        issues: photo.issues,
      })),
    },
    publisher,
  );
  return { activity, review, labels: new Map(photos.map((photo) => [photo.mediaId, photo.label])) };
}

const firstProblems = (texts: string[]) =>
  texts.length === 1 ? texts[0]! : `${texts[0]} (y ${texts.length - 1} punto(s) más).`;

/** "Enviar a revisión": authors, with warnings allowed (docs/07 §6.5). */
export async function submitForReview(activityId: string): Promise<PublishResult> {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  const loaded = await loadReview(activityId, false);
  if (!loaded) return { ok: false, error: "No se encontró la actividad." };
  if (!loaded.review.canSubmit) {
    const blocking = loaded.review.items.filter((item) => item.level === "error");
    return { ok: false, error: firstProblems(blocking.map((item) => item.text)) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .update({ status: "review" })
    .eq("id", activityId)
    .eq("status", "draft")
    .select("id");
  if (error) return { ok: false, error: publishError(error, loaded.labels) };
  if (data.length === 0) return { ok: false, error: "La actividad ya no es un borrador." };

  revalidatePath(ACTIVITIES_PATH, "layout");
  return { ok: true, outcome: "review" };
}

/**
 * "Publicar ahora" or "Programar" (Colombian date and time): content.publish,
 * nothing red. The database checks HU-06 and RN-A-02 again.
 */
export async function publishActivity(
  activityId: string,
  schedule?: { date: string; time: string },
): Promise<PublishResult> {
  const authorized = await authorizeAction("content.publish");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  let publishedAt: string | null = null;
  if (schedule) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(schedule.date) || !/^\d{2}:\d{2}$/.test(schedule.time)) {
      return { ok: false, error: "Escribe la fecha y la hora de publicación." };
    }
    publishedAt = toBogotaInstant(schedule.date, schedule.time);
    if (new Date(publishedAt).getTime() <= Date.now() + 60_000) {
      return { ok: false, error: "La fecha de publicación programada debe ser futura." };
    }
  }

  const loaded = await loadReview(activityId, true);
  if (!loaded) return { ok: false, error: "No se encontró la actividad." };
  if (!loaded.review.canPublish) {
    const blocking = loaded.review.items.filter((item) => item.level === "error");
    return { ok: false, error: firstProblems(blocking.map((item) => item.text)) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .update({ status: "published", published_at: publishedAt })
    .eq("id", activityId)
    .in("status", ["draft", "review"])
    .select("id");
  if (error) return { ok: false, error: publishError(error, loaded.labels) };
  if (data.length === 0)
    return { ok: false, error: "La actividad ya estaba publicada o archivada." };

  revalidatePath(ACTIVITIES_PATH, "layout");
  return { ok: true, outcome: schedule ? "scheduled" : "published" };
}

export type StatusChange = "returned" | "retired" | "archived" | "reopened";
export type StatusResult = { ok: true } | { ok: false; error: string };

const STATUS_CHANGES: Record<
  StatusChange,
  { from: ActivityStatus[]; to: ActivityStatus; stale: string }
> = {
  returned: { from: ["review"], to: "draft", stale: "La actividad ya no está en revisión." },
  retired: { from: ["published"], to: "draft", stale: "La actividad ya no está publicada." },
  archived: { from: ["published"], to: "archived", stale: "La actividad ya no está publicada." },
  reopened: { from: ["archived"], to: "draft", stale: "La actividad ya no está archivada." },
};

/**
 * Editor actions on the state of an activity (step 7.4b, decision F7-D7):
 * return from review with a required note, retire a published one to fix it
 * (optional note), archive, reopen an archived one. The database checks the
 * transition, the permission and the note again.
 */
export async function changeActivityStatus(
  activityId: string,
  change: StatusChange,
  note?: string,
): Promise<StatusResult> {
  const authorized = await authorizeAction("content.publish");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(activityId).success || !Object.hasOwn(STATUS_CHANGES, change)) {
    return { ok: false, error: "Datos no válidos." };
  }

  let reviewNote: string | undefined;
  if (change === "returned" || change === "retired") {
    const parsed = (change === "returned" ? reviewNoteSchema : optionalNoteSchema).safeParse(
      note ?? "",
    );
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    reviewNote = parsed.data;
  }

  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  const { from, to, stale } = STATUS_CHANGES[change];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .update(reviewNote ? { status: to, review_note: reviewNote } : { status: to })
    .eq("id", activityId)
    .in("status", from)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    return {
      ok: false,
      error:
        error.code === FORBIDDEN
          ? "No tienes permiso para hacer esto."
          : "No se pudo cambiar el estado. Vuelve a intentarlo.",
    };
  }
  if (data.length === 0) return { ok: false, error: stale };

  revalidatePath(ACTIVITIES_PATH, "layout");
  return { ok: true };
}

/** Turns one existing tag on or off for the activity (RLS: who can edit it). */
export async function setActivityTag(
  activityId: string,
  tagId: string,
  on: boolean,
): Promise<StatusResult> {
  const context = await photoContext();
  if ("error" in context) return { ok: false, error: context.error ?? "Sin permiso." };
  if (!idSchema.safeParse(activityId).success || !idSchema.safeParse(tagId).success) {
    return { ok: false, error: "Datos no válidos." };
  }
  const { supabase } = context;

  const { error } = on
    ? await supabase.from("activity_tags").insert({ activity_id: activityId, tag_id: tagId })
    : await supabase
        .from("activity_tags")
        .delete()
        .eq("activity_id", activityId)
        .eq("tag_id", tagId);
  // Already on (double tap): nothing to do
  if (error && error.code !== UNIQUE_VIOLATION) {
    return {
      ok: false,
      error:
        error.code === FORBIDDEN
          ? "No tienes permiso para cambiar las etiquetas de esta actividad."
          : "No se pudo guardar la etiqueta.",
    };
  }
  revalidatePath(ACTIVITIES_PATH, "layout");
  return { ok: true };
}

const MAX_PICKED = 50;

/**
 * Adds photos chosen from the library at the end, in the order picked.
 * Photos already in the activity are skipped.
 */
export async function attachPhotos(
  activityId: string,
  mediaIds: string[],
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const context = await photoContext();
  if ("error" in context) return { ok: false, error: context.error ?? "Sin permiso." };
  const ids = z.array(idSchema).min(1).max(MAX_PICKED).safeParse(mediaIds);
  if (!idSchema.safeParse(activityId).success || !ids.success) {
    return { ok: false, error: `Elige entre 1 y ${MAX_PICKED} fotos.` };
  }
  const { supabase } = context;

  const { data: activity } = await supabase
    .from("activities")
    .select("cover_media_id, activity_media(media_id, position)")
    .eq("id", activityId)
    .maybeSingle();
  if (!activity) return { ok: false, error: "No se encontró la actividad." };

  const present = new Set(activity.activity_media.map((link) => link.media_id));
  const fresh = [...new Set(ids.data)].filter((id) => !present.has(id));
  if (fresh.length > 0) {
    const last = Math.max(0, ...activity.activity_media.map((link) => link.position));
    const { error } = await supabase.from("activity_media").insert(
      fresh.map((mediaId, index) => ({
        activity_id: activityId,
        media_id: mediaId,
        position: last + 1 + index,
      })),
    );
    if (error) return { ok: false, error: photoError(error.code) };

    if (!activity.cover_media_id) {
      await supabase.from("activities").update({ cover_media_id: fresh[0] }).eq("id", activityId);
    }
  }
  revalidatePath(ACTIVITIES_PATH, "layout");
  return { ok: true, added: fresh.length };
}
