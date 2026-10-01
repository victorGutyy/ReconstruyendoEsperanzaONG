"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/guard";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { syncContentPhotos } from "@/modules/content";
import { getPublishIssues } from "@/modules/media";

import { type PostInput, postSchema, POSTS_PATH, reviewPost } from "./schema";

const SLUG_BASE_MAX = 110;
const UNIQUE_VIOLATION = "23505";
const FORBIDDEN = "42501";
const idSchema = z.uuid();

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SaveResult = { ok: true; id: string; savedAt: string } | { ok: false; error: string };
export type PostResult = { ok: true } | { ok: false; error: string };
export type PublishResult =
  { ok: true; outcome: "review" | "published" | "scheduled" } | { ok: false; error: string };

async function limited(userId: string): Promise<string | null> {
  const attempt = await getRateLimiter().limit(RATE_LIMITS.panelActions, rateLimitKey(userId));
  return attempt.success ? null : "Demasiadas acciones seguidas. Espera un momento.";
}

/** A free slug for the title among stories not in the trash (except `exceptId`). */
async function freeSlug(supabase: Supabase, title: string, exceptId?: string): Promise<string> {
  const base = slugify(title, SLUG_BASE_MAX) || "historia";
  let query = supabase.from("posts").select("slug").like("slug", `${base}%`).is("deleted_at", null);
  if (exceptId) query = query.neq("id", exceptId);
  const { data } = await query;
  return uniqueSlug(base, new Set((data ?? []).map((row) => row.slug)));
}

/**
 * Creates or updates a story (also the autosave). Category and excerpt may be
 * empty in a draft; they are required to publish.
 */
export async function savePost(input: { id?: string; fields: PostInput }): Promise<SaveResult> {
  const authorized = await authorizeAction(input.id ? "content.read" : "content.create");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  const parsed = postSchema.safeParse(input.fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  const supabase = await createClient();

  if (!input.id) {
    // Two tries: another story could take the same slug in between
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const slug = await freeSlug(supabase, parsed.data.title);
      const { data, error } = await supabase
        .from("posts")
        .insert({ ...parsed.data, slug })
        .select("id, updated_at")
        .single();
      if (!error && data) {
        revalidatePath(POSTS_PATH, "layout");
        return { ok: true, id: data.id, savedAt: data.updated_at };
      }
      if (error?.code !== UNIQUE_VIOLATION) break;
    }
    return { ok: false, error: "No se pudo crear la historia." };
  }

  if (!idSchema.safeParse(input.id).success) return { ok: false, error: "Historia no válida." };
  const { data: current } = await supabase
    .from("posts")
    .select("title, published_at")
    .eq("id", input.id)
    .maybeSingle();
  if (!current) return { ok: false, error: "No se encontró la historia." };

  // The slug follows the title until the story is published (then it is frozen)
  const slug =
    current.published_at === null && current.title !== parsed.data.title
      ? await freeSlug(supabase, parsed.data.title, input.id)
      : undefined;

  const { data, error } = await supabase
    .from("posts")
    .update({ ...parsed.data, ...(slug ? { slug } : {}) })
    .eq("id", input.id)
    .is("deleted_at", null)
    .select("id, updated_at");
  if (error) {
    return {
      ok: false,
      error:
        error.code === FORBIDDEN
          ? "No tienes permiso para editar esta historia."
          : "No se pudieron guardar los cambios.",
    };
  }
  if (data.length === 0) {
    return { ok: false, error: "No puedes editar esta historia (ya fue publicada o no es tuya)." };
  }
  revalidatePath(POSTS_PATH, "layout");
  return { ok: true, id: data[0]!.id, savedAt: data[0]!.updated_at };
}

/** Sets or removes the cover; public copies follow if the story is published. */
export async function setPostCover(postId: string, mediaId: string | null): Promise<PostResult> {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(postId).success || (mediaId && !idSchema.safeParse(mediaId).success)) {
    return { ok: false, error: "Datos no válidos." };
  }
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("posts")
    .select("cover_media_id")
    .eq("id", postId)
    .maybeSingle();
  if (!current) return { ok: false, error: "No se encontró la historia." };

  const { data, error } = await supabase
    .from("posts")
    .update({ cover_media_id: mediaId })
    .eq("id", postId)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23514"
          ? "Esa foto no se puede usar en una historia publicada: revisa su descripción y autorizaciones."
          : "No se pudo cambiar la portada.",
    };
  }
  if (data.length === 0) return { ok: false, error: "No puedes editar esta historia." };

  await syncContentPhotos(supabase, "post", postId, {
    extra: current.cover_media_id ? [current.cover_media_id] : [],
  });
  revalidatePath(POSTS_PATH, "layout");
  return { ok: true };
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

  const { data, error } = await supabase
    .from("posts")
    .update({ status: "review" })
    .eq("id", postId)
    .eq("status", "draft")
    .select("id");
  if (error) return { ok: false, error: "No se pudo enviar a revisión." };
  if (data.length === 0) return { ok: false, error: "La historia ya no es un borrador." };

  revalidatePath(POSTS_PATH, "layout");
  return { ok: true, outcome: "review" };
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(schedule.date) || !/^\d{2}:\d{2}$/.test(schedule.time)) {
      return { ok: false, error: "Escribe la fecha y la hora de publicación." };
    }
    // Colombia has no daylight saving time: always UTC-5
    publishedAt = new Date(`${schedule.date}T${schedule.time}:00-05:00`).toISOString();
    if (new Date(publishedAt).getTime() <= Date.now() + 60_000) {
      return { ok: false, error: "La fecha de publicación programada debe ser futura." };
    }
  }

  const supabase = await createClient();
  const review = await loadReview(supabase, postId, true);
  if (!review) return { ok: false, error: "No se encontró la historia." };
  if (!review.canPublish) return { ok: false, error: firstProblem(review.items) };

  const { data, error } = await supabase
    .from("posts")
    .update({ status: "published", published_at: publishedAt })
    .eq("id", postId)
    .in("status", ["draft", "review"])
    .select("id");
  if (error) {
    return {
      ok: false,
      error: error.message?.includes("media_not_publishable")
        ? "La portada no se puede publicar todavía: revisa su descripción y autorizaciones."
        : error.code === FORBIDDEN
          ? "No tienes permiso para publicar."
          : "No se pudo publicar. Vuelve a intentarlo.",
    };
  }
  if (data.length === 0) {
    return { ok: false, error: "La historia ya estaba publicada o archivada." };
  }

  await syncContentPhotos(supabase, "post", postId);
  revalidatePath(POSTS_PATH, "layout");
  return { ok: true, outcome: schedule ? "scheduled" : "published" };
}
