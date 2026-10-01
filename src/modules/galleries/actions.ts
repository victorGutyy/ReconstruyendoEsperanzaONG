"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/guard";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  parseSchedule,
  publishContent,
  type PublishResult,
  saveContentRow,
  type SaveResult,
  submitContent,
  syncContentPhotos,
} from "@/modules/content";
import { getPublishIssues } from "@/modules/media";

import { GALLERIES_PATH, type GalleryInput, gallerySchema, reviewGallery } from "./schema";

const idSchema = z.uuid();
const MAX_PICKED = 50;

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function limited(userId: string): Promise<string | null> {
  const attempt = await getRateLimiter().limit(RATE_LIMITS.panelActions, rateLimitKey(userId));
  return attempt.success ? null : "Demasiadas acciones seguidas. Espera un momento.";
}

/** Permission, rate limit and a session client for the photo actions. */
async function photoContext(galleryId: string) {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { error: authorized.error } as const;
  if (!idSchema.safeParse(galleryId).success) return { error: "Galería no válida." } as const;
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { error: tooMany } as const;
  return { supabase: await createClient() } as const;
}

const photoError = (code?: string) =>
  code === "23514"
    ? "Esa foto no se puede usar en una galería publicada: revisa su descripción y autorizaciones."
    : code === "42501"
      ? "No tienes permiso para cambiar las fotos de esta galería."
      : "No se pudo actualizar la foto.";

/** Creates or updates a gallery (also the autosave). */
export async function saveGallery(input: {
  id?: string;
  fields: GalleryInput;
}): Promise<SaveResult> {
  const authorized = await authorizeAction(input.id ? "content.read" : "content.create");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (input.id && !idSchema.safeParse(input.id).success) {
    return { ok: false, error: "Galería no válida." };
  }
  const parsed = gallerySchema.safeParse(input.fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  return saveContentRow(await createClient(), "gallery", parsed.data, input.id);
}

/** Adds photos chosen from the library at the end; the first one becomes the cover. */
export async function addGalleryPhotos(
  galleryId: string,
  mediaIds: string[],
): Promise<ActionResult> {
  const context = await photoContext(galleryId);
  if ("error" in context) return { ok: false, error: context.error ?? "Sin permiso." };
  const ids = z.array(idSchema).min(1).max(MAX_PICKED).safeParse(mediaIds);
  if (!ids.success) return { ok: false, error: `Elige entre 1 y ${MAX_PICKED} fotos.` };
  const { supabase } = context;

  const { data: gallery } = await supabase
    .from("galleries")
    .select("cover_media_id, gallery_items(media_id, position)")
    .eq("id", galleryId)
    .maybeSingle();
  if (!gallery) return { ok: false, error: "No se encontró la galería." };

  const present = new Set(gallery.gallery_items.map((item) => item.media_id));
  const fresh = [...new Set(ids.data)].filter((id) => !present.has(id));
  if (fresh.length > 0) {
    const last = Math.max(0, ...gallery.gallery_items.map((item) => item.position));
    const { error } = await supabase.from("gallery_items").insert(
      fresh.map((mediaId, index) => ({
        gallery_id: galleryId,
        media_id: mediaId,
        position: last + 1 + index,
      })),
    );
    if (error) return { ok: false, error: photoError(error.code) };
    if (!gallery.cover_media_id) {
      await supabase.from("galleries").update({ cover_media_id: fresh[0] }).eq("id", galleryId);
    }
    await syncContentPhotos(supabase, "gallery", galleryId);
  }
  revalidatePath(GALLERIES_PATH, "layout");
  return { ok: true };
}

/** Moves a photo one place, renumbering the photos 1…n. */
export async function moveGalleryPhoto(
  galleryId: string,
  mediaId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const context = await photoContext(galleryId);
  if ("error" in context) return { ok: false, error: context.error ?? "Sin permiso." };
  const { supabase } = context;

  const { data: items } = await supabase
    .from("gallery_items")
    .select("id, media_id, position")
    .eq("gallery_id", galleryId)
    .order("position");
  if (!items) return { ok: false, error: "No se encontró la galería." };

  const from = items.findIndex((item) => item.media_id === mediaId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= items.length) return { ok: true };
  [items[from], items[to]] = [items[to]!, items[from]!];

  for (const [index, item] of items.entries()) {
    if (item.position === index + 1) continue;
    const { error } = await supabase
      .from("gallery_items")
      .update({ position: index + 1 })
      .eq("id", item.id);
    if (error) return { ok: false, error: photoError(error.code) };
  }
  revalidatePath(GALLERIES_PATH, "layout");
  return { ok: true };
}

/** Removes a photo from the gallery (it stays in the library). */
export async function removeGalleryPhoto(
  galleryId: string,
  mediaId: string,
): Promise<ActionResult> {
  const context = await photoContext(galleryId);
  if ("error" in context) return { ok: false, error: context.error ?? "Sin permiso." };
  if (!idSchema.safeParse(mediaId).success) return { ok: false, error: "Foto no válida." };
  const { supabase } = context;

  const { data: gallery } = await supabase
    .from("galleries")
    .select("cover_media_id, gallery_items(media_id, position)")
    .eq("id", galleryId)
    .maybeSingle();
  if (!gallery) return { ok: false, error: "No se encontró la galería." };

  const { data, error } = await supabase
    .from("gallery_items")
    .delete()
    .eq("gallery_id", galleryId)
    .eq("media_id", mediaId)
    .select("id");
  if (error || data.length === 0) return { ok: false, error: photoError(error?.code) };

  if (gallery.cover_media_id === mediaId) {
    const next = gallery.gallery_items
      .filter((item) => item.media_id !== mediaId)
      .sort((a, b) => a.position - b.position)[0];
    await supabase
      .from("galleries")
      .update({ cover_media_id: next?.media_id ?? null })
      .eq("id", galleryId);
  }
  await syncContentPhotos(supabase, "gallery", galleryId, { extra: [mediaId] });
  revalidatePath(GALLERIES_PATH, "layout");
  return { ok: true };
}

/** One of the gallery's photos becomes its cover. */
export async function setGalleryCover(galleryId: string, mediaId: string): Promise<ActionResult> {
  const context = await photoContext(galleryId);
  if ("error" in context) return { ok: false, error: context.error ?? "Sin permiso." };
  const { supabase } = context;

  const { data: item } = await supabase
    .from("gallery_items")
    .select("id")
    .eq("gallery_id", galleryId)
    .eq("media_id", mediaId)
    .maybeSingle();
  if (!item) return { ok: false, error: "La foto no pertenece a esta galería." };

  const { data, error } = await supabase
    .from("galleries")
    .update({ cover_media_id: mediaId })
    .eq("id", galleryId)
    .select("id");
  if (error || data.length === 0) return { ok: false, error: photoError(error?.code) };
  revalidatePath(GALLERIES_PATH, "layout");
  return { ok: true };
}

const captionSchema = z
  .string()
  .trim()
  .max(300, "El pie de foto es demasiado largo (máximo 300 caracteres).")
  .transform((text) => (text === "" ? null : text));

/** The caption of one photo in this gallery (not the photo's own description). */
export async function setGalleryCaption(
  galleryId: string,
  mediaId: string,
  caption: string,
): Promise<ActionResult> {
  const context = await photoContext(galleryId);
  if ("error" in context) return { ok: false, error: context.error ?? "Sin permiso." };
  const parsed = captionSchema.safeParse(caption);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { supabase } = context;

  const { data, error } = await supabase
    .from("gallery_items")
    .update({ caption: parsed.data })
    .eq("gallery_id", galleryId)
    .eq("media_id", mediaId)
    .select("id");
  if (error || data.length === 0) return { ok: false, error: "No se pudo guardar el pie de foto." };
  revalidatePath(GALLERIES_PATH, "layout");
  return { ok: true };
}

async function loadReview(supabase: Supabase, galleryId: string, publisher: boolean) {
  const { data } = await supabase
    .from("galleries")
    .select("deleted_at, gallery_items(media_id, position, media(alt_text, processing_status))")
    .eq("id", galleryId)
    .maybeSingle();
  if (!data || data.deleted_at) return null;
  const items = [...data.gallery_items].sort((a, b) => a.position - b.position);
  const issues = await getPublishIssues(items.map((item) => item.media_id));
  return reviewGallery(
    items.map((item, index) => ({
      label: item.media?.alt_text
        ? `Foto ${index + 1} («${item.media.alt_text}»)`
        : `Foto ${index + 1}`,
      processing: item.media?.processing_status !== "ready",
      issues: issues.get(item.media_id) ?? [],
    })),
    publisher,
  );
}

const firstProblem = (items: { level: string; text: string }[]) =>
  items.find((item) => item.level === "error")?.text ?? "Revisa la galería.";

/** "Enviar a revisión": anyone who can edit the draft. */
export async function submitGallery(galleryId: string): Promise<PublishResult> {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(galleryId).success) return { ok: false, error: "Galería no válida." };

  const supabase = await createClient();
  const review = await loadReview(supabase, galleryId, false);
  if (!review) return { ok: false, error: "No se encontró la galería." };
  if (!review.canSubmit) return { ok: false, error: firstProblem(review.items) };
  return submitContent(supabase, "gallery", galleryId);
}

/** "Publicar ahora" or "Programar": content.publish, every photo publishable. */
export async function publishGallery(
  galleryId: string,
  schedule?: { date: string; time: string },
): Promise<PublishResult> {
  const authorized = await authorizeAction("content.publish");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(galleryId).success) return { ok: false, error: "Galería no válida." };

  let publishedAt: string | null = null;
  if (schedule) {
    const parsed = parseSchedule(schedule);
    if (!parsed.ok) return parsed;
    publishedAt = parsed.publishedAt;
  }

  const supabase = await createClient();
  const review = await loadReview(supabase, galleryId, true);
  if (!review) return { ok: false, error: "No se encontró la galería." };
  if (!review.canPublish) return { ok: false, error: firstProblem(review.items) };
  return publishContent(supabase, "gallery", galleryId, publishedAt);
}
