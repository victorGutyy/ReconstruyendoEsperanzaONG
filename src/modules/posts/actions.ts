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
  refreshPublicIfPublished,
  saveContentRow,
  type SaveResult,
  setContentCover,
  type StatusResult,
  submitContent,
} from "@/modules/content";
import { getPublishIssues } from "@/modules/media";

import { type PostInput, postSchema, reviewPost } from "./schema";

const idSchema = z.uuid();

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function limited(userId: string): Promise<string | null> {
  const attempt = await getRateLimiter().limit(RATE_LIMITS.panelActions, rateLimitKey(userId));
  return attempt.success ? null : "Demasiadas acciones seguidas. Espera un momento.";
}

/**
 * Creates or updates a story (also the autosave). Category and excerpt may be
 * empty in a draft; they are required to publish.
 */
export async function savePost(input: { id?: string; fields: PostInput }): Promise<SaveResult> {
  const authorized = await authorizeAction(input.id ? "content.read" : "content.create");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (input.id && !idSchema.safeParse(input.id).success) {
    return { ok: false, error: "Historia no válida." };
  }

  const parsed = postSchema.safeParse(input.fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  return saveContentRow(await createClient(), "post", parsed.data, input.id);
}

/** Sets or removes the cover; public copies follow if the story is published. */
export async function setPostCover(postId: string, mediaId: string | null): Promise<ActionResult> {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(postId).success || (mediaId && !idSchema.safeParse(mediaId).success)) {
    return { ok: false, error: "Datos no válidos." };
  }
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  return setContentCover(await createClient(), "post", postId, mediaId);
}

async function loadReview(supabase: Supabase, postId: string, publisher: boolean) {
  const { data } = await supabase
    .from("posts")
    .select("excerpt, category_id, cover_media_id, deleted_at")
    .eq("id", postId)
    .maybeSingle();
  if (!data || data.deleted_at) return null;
  const issues = data.cover_media_id
    ? ((await getPublishIssues([data.cover_media_id])).get(data.cover_media_id) ?? [])
    : null;
  return reviewPost(
    { excerpt: data.excerpt, categoryId: data.category_id, coverIssues: issues },
    publisher,
  );
}

const firstProblem = (items: { level: string; text: string }[]) =>
  items.find((item) => item.level === "error")?.text ?? "Revisa la historia.";

/** "Enviar a revisión": anyone who can edit the draft. */
export async function submitPost(postId: string): Promise<PublishResult> {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(postId).success) return { ok: false, error: "Historia no válida." };

  const supabase = await createClient();
  const review = await loadReview(supabase, postId, false);
  if (!review) return { ok: false, error: "No se encontró la historia." };
  if (!review.canSubmit) return { ok: false, error: firstProblem(review.items) };
  return submitContent(supabase, "post", postId);
}

/**
 * "Publicar ahora" or "Programar" (Colombian date and time): content.publish,
 * nothing red. The database checks the cover and the required fields again.
 */
export async function publishPost(
  postId: string,
  schedule?: { date: string; time: string },
): Promise<PublishResult> {
  const authorized = await authorizeAction("content.publish");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(postId).success) return { ok: false, error: "Historia no válida." };

  let publishedAt: string | null = null;
  if (schedule) {
    const parsed = parseSchedule(schedule);
    if (!parsed.ok) return parsed;
    publishedAt = parsed.publishedAt;
  }

  const supabase = await createClient();
  const review = await loadReview(supabase, postId, true);
  if (!review) return { ok: false, error: "No se encontró la historia." };
  if (!review.canPublish) return { ok: false, error: firstProblem(review.items) };
  return publishContent(supabase, "post", postId, publishedAt);
}

/**
 * Turns one tag of the story on or off (step 8.3). The database decides who
 * may (whoever may edit the story); a published story refreshes the site.
 */
export async function setPostTag(
  postId: string,
  tagId: string,
  on: boolean,
): Promise<StatusResult> {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(postId).success || !idSchema.safeParse(tagId).success) {
    return { ok: false, error: "Datos no válidos." };
  }
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("post_tags").insert({ post_id: postId, tag_id: tagId })
    : await supabase.from("post_tags").delete().eq("post_id", postId).eq("tag_id", tagId);
  // Already on (double tap): nothing to do
  if (error && error.code !== "23505") {
    return {
      ok: false,
      error:
        error.code === "42501"
          ? "No tienes permiso para cambiar las etiquetas de esta historia."
          : "No se pudo guardar la etiqueta.",
    };
  }
  await refreshPublicIfPublished(supabase, "post", postId);
  return { ok: true };
}
