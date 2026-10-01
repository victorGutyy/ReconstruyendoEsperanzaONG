"use server";

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
  setContentCover,
  submitContent,
} from "@/modules/content";
import { getPublishIssues } from "@/modules/media";

import { reviewVideo, type VideoInput, videoSchema } from "./schema";

const idSchema = z.uuid();

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function limited(userId: string): Promise<string | null> {
  const attempt = await getRateLimiter().limit(RATE_LIMITS.panelActions, rateLimitKey(userId));
  return attempt.success ? null : "Demasiadas acciones seguidas. Espera un momento.";
}

/**
 * Creates or updates a video (also the autosave). The pasted link is turned
 * into provider + id here, on the server; the link itself is not stored.
 */
export async function saveVideo(input: { id?: string; fields: VideoInput }): Promise<SaveResult> {
  const authorized = await authorizeAction(input.id ? "content.read" : "content.create");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (input.id && !idSchema.safeParse(input.id).success) {
    return { ok: false, error: "Video no válido." };
  }
  const parsed = videoSchema.safeParse(input.fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  return saveContentRow(await createClient(), "video", parsed.data, input.id);
}

/** Sets or removes the cover (a photo of the library, never a provider thumbnail). */
export async function setVideoCover(
  videoId: string,
  mediaId: string | null,
): Promise<ActionResult> {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(videoId).success || (mediaId && !idSchema.safeParse(mediaId).success)) {
    return { ok: false, error: "Datos no válidos." };
  }
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  return setContentCover(await createClient(), "video", videoId, mediaId);
}

async function loadReview(supabase: Supabase, videoId: string, publisher: boolean) {
  const { data } = await supabase
    .from("videos")
    .select("cover_media_id, deleted_at")
    .eq("id", videoId)
    .maybeSingle();
  if (!data || data.deleted_at) return null;
  const issues = data.cover_media_id
    ? ((await getPublishIssues([data.cover_media_id])).get(data.cover_media_id) ?? [])
    : null;
  return reviewVideo(issues, publisher);
}

const firstProblem = (items: { level: string; text: string }[]) =>
  items.find((item) => item.level === "error")?.text ?? "Revisa el video.";

/** "Enviar a revisión": anyone who can edit the draft. */
export async function submitVideo(videoId: string): Promise<PublishResult> {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(videoId).success) return { ok: false, error: "Video no válido." };

  const supabase = await createClient();
  const review = await loadReview(supabase, videoId, false);
  if (!review) return { ok: false, error: "No se encontró el video." };
  if (!review.canSubmit) return { ok: false, error: firstProblem(review.items) };
  return submitContent(supabase, "video", videoId);
}

/** "Publicar ahora" or "Programar": content.publish, nothing red. */
export async function publishVideo(
  videoId: string,
  schedule?: { date: string; time: string },
): Promise<PublishResult> {
  const authorized = await authorizeAction("content.publish");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(videoId).success) return { ok: false, error: "Video no válido." };

  let publishedAt: string | null = null;
  if (schedule) {
    const parsed = parseSchedule(schedule);
    if (!parsed.ok) return parsed;
    publishedAt = parsed.publishedAt;
  }

  const supabase = await createClient();
  const review = await loadReview(supabase, videoId, true);
  if (!review) return { ok: false, error: "No se encontró el video." };
  if (!review.canPublish) return { ok: false, error: firstProblem(review.items) };
  return publishContent(supabase, "video", videoId, publishedAt);
}
