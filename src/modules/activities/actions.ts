"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/lib/auth/guard";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { slugify, uniqueSlug } from "@/lib/utils/slug";

import { type BasicsInput, basicsSchema, type PhotoResult, type SaveResult } from "./schema";

const ACTIVITIES_PATH = "/admin/actividades";
const SLUG_BASE_MAX = 110;
const UNIQUE_VIOLATION = "23505";
const FORBIDDEN = "42501";

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
