import "server-only";

import { revalidatePath } from "next/cache";

import type { createClient } from "@/lib/supabase/server";
import { slugify, uniqueSlug } from "@/lib/utils/slug";

import { contentTable, refreshPublicIfPublished, syncContentPhotos } from "./media";
import { agree, CONTENT_TYPES, type ContentType, theType } from "./registry";
import type { ActionResult, PublishResult, SaveResult } from "./types";

// Shared server steps of the single-page content editors (step 7.6b). Each
// module's Server Action authorizes and validates first, then calls these.

type Supabase = Awaited<ReturnType<typeof createClient>>;

const SLUG_BASE_MAX = 110;
const UNIQUE_VIOLATION = "23505";
const FORBIDDEN = "42501";

/** A free slug for the title among rows not in the trash (except `exceptId`). */
async function freeSlug(
  supabase: Supabase,
  type: ContentType,
  title: string,
  exceptId?: string,
): Promise<string> {
  const base = slugify(title, SLUG_BASE_MAX) || CONTENT_TYPES[type].singular;
  let query = contentTable(supabase, type)
    .select("slug")
    .like("slug", `${base}%`)
    .is("deleted_at", null);
  if (exceptId) query = query.neq("id", exceptId);
  const { data } = await query;
  return uniqueSlug(base, new Set((data ?? []).map((row) => row.slug)));
}

/**
 * Creates the row or updates it (also the autosave). The slug follows the
 * title until the content is published, then it is frozen.
 */
export async function saveContentRow(
  supabase: Supabase,
  type: ContentType,
  /** With a slug, `title` names it; content without a page may have no title. */
  columns: Record<string, unknown> & { title?: string },
  id?: string,
): Promise<SaveResult> {
  const table = () => contentTable(supabase, type);
  const what = CONTENT_TYPES[type].singular;

  const duplicate = `${agree(type, "Esa", "Ese")} ${what} ya está ${agree(type, "registrada", "registrado")}.`;

  // Content without a page of its own has no slug (videos)
  if (!CONTENT_TYPES[type].hasSlug) {
    const { data, error } = id
      ? await table()
          .update(columns as never)
          .eq("id", id)
          .is("deleted_at", null)
          .select("id, updated_at")
          .maybeSingle()
      : await table()
          .insert(columns as never)
          .select("id, updated_at")
          .single();
    if (error) {
      return {
        ok: false,
        error:
          error.code === UNIQUE_VIOLATION
            ? duplicate
            : error.code === FORBIDDEN
              ? `No tienes permiso para editar ${agree(type, "esta", "este")} ${what}.`
              : "No se pudieron guardar los cambios.",
      };
    }
    if (!data) {
      return { ok: false, error: `No puedes editar ${agree(type, "esta", "este")} ${what}.` };
    }
    if (id) await refreshPublicIfPublished(supabase, type, id);
    revalidatePath(CONTENT_TYPES[type].listPath, "layout");
    return { ok: true, id: data.id, savedAt: data.updated_at };
  }

  if (!id) {
    // Two tries: another row could take the same slug in between
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const slug = await freeSlug(supabase, type, columns.title ?? "");
      const { data, error } = await table()
        .insert({ ...columns, slug } as never)
        .select("id, updated_at")
        .single();
      if (!error && data) {
        revalidatePath(CONTENT_TYPES[type].listPath, "layout");
        return { ok: true, id: data.id, savedAt: data.updated_at };
      }
      if (error?.code !== UNIQUE_VIOLATION) break;
    }
    return { ok: false, error: `No se pudo crear ${agree(type, "la", "el")} ${what}.` };
  }

  const { data: current } = await table().select("title, published_at").eq("id", id).maybeSingle();
  if (!current) return { ok: false, error: `No se encontró ${agree(type, "la", "el")} ${what}.` };

  const slug =
    current.published_at === null && current.title !== columns.title
      ? await freeSlug(supabase, type, columns.title ?? "", id)
      : undefined;

  const { data, error } = await table()
    .update({ ...columns, ...(slug ? { slug } : {}) } as never)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, updated_at");
  if (error) {
    return {
      ok: false,
      error:
        error.code === FORBIDDEN
          ? `No tienes permiso para editar ${agree(type, "esta", "este")} ${what}.`
          : "No se pudieron guardar los cambios.",
    };
  }
  if (data.length === 0) {
    return {
      ok: false,
      error: `No puedes editar ${agree(type, "esta", "este")} ${what} (ya fue ${agree(type, "publicada", "publicado")} o no es ${agree(type, "tuya", "tuyo")}).`,
    };
  }
  await refreshPublicIfPublished(supabase, type, id);
  revalidatePath(CONTENT_TYPES[type].listPath, "layout");
  return { ok: true, id: data[0]!.id, savedAt: data[0]!.updated_at };
}

/** Sets or removes the cover; public copies follow if the content is published. */
export async function setContentCover(
  supabase: Supabase,
  type: ContentType,
  id: string,
  mediaId: string | null,
): Promise<ActionResult> {
  const { data: current } = await contentTable(supabase, type)
    .select("cover_media_id")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: `No se encontró ${theType(type).toLowerCase()}.` };

  const { data, error } = await contentTable(supabase, type)
    .update({ cover_media_id: mediaId })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23514"
          ? "Esa foto no se puede usar en contenido publicado: revisa su descripción y autorizaciones."
          : "No se pudo cambiar la portada.",
    };
  }
  if (data.length === 0) return { ok: false, error: "No puedes editar este contenido." };

  await syncContentPhotos(supabase, type, id, {
    extra: current.cover_media_id ? [current.cover_media_id] : [],
  });
  revalidatePath(CONTENT_TYPES[type].listPath, "layout");
  return { ok: true };
}

/** "Enviar a revisión" once the module's review allows it. */
export async function submitContent(
  supabase: Supabase,
  type: ContentType,
  id: string,
): Promise<PublishResult> {
  const { data, error } = await contentTable(supabase, type)
    .update({ status: "review" })
    .eq("id", id)
    .eq("status", "draft")
    .select("id");
  if (error) return { ok: false, error: "No se pudo enviar a revisión." };
  if (data.length === 0) {
    return { ok: false, error: `${theType(type)} ya no es un borrador.` };
  }
  revalidatePath(CONTENT_TYPES[type].listPath, "layout");
  return { ok: true, outcome: "review" };
}

/** "Publicar ahora" (publishedAt null) or "Programar", then the photos follow. */
export async function publishContent(
  supabase: Supabase,
  type: ContentType,
  id: string,
  publishedAt: string | null,
): Promise<PublishResult> {
  const { data, error } = await contentTable(supabase, type)
    .update({ status: "published", published_at: publishedAt })
    .eq("id", id)
    .in("status", ["draft", "review"])
    .select("id");
  if (error) {
    return {
      ok: false,
      error: error.message?.includes("media_not_publishable")
        ? "Una foto no se puede publicar todavía: revisa su descripción y autorizaciones."
        : error.message?.includes("gallery_empty")
          ? "La galería no tiene fotos."
          : error.code === FORBIDDEN
            ? "No tienes permiso para publicar."
            : "No se pudo publicar. Vuelve a intentarlo.",
    };
  }
  if (data.length === 0) {
    return {
      ok: false,
      error: `${theType(type)} ya estaba ${agree(type, "publicada o archivada", "publicado o archivado")}.`,
    };
  }

  await syncContentPhotos(supabase, type, id);
  revalidatePath(CONTENT_TYPES[type].listPath, "layout");
  return { ok: true, outcome: publishedAt ? "scheduled" : "published" };
}
