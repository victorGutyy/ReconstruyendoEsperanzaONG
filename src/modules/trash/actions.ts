"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/guard";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  agree,
  CONTENT_TYPES,
  contentTable,
  type ContentType,
  syncContentPhotos,
  theType,
  thisType,
} from "@/modules/content";
import { removeMediaFiles, syncPublicMediaAfter } from "@/modules/media";

import { photoUses, tableFor } from "./queries";
import {
  isTrashableType,
  kindName,
  purgeSchema,
  TRASH_PATH,
  trashListPath,
  type TrashKind,
  trashTargetSchema,
} from "./schema";

export type TrashResult = { ok: true } | { ok: false; error: string };

const NOT_ALLOWED = "No tienes permiso para hacer esto.";

async function limited(userId: string): Promise<string | null> {
  const attempt = await getRateLimiter().limit(RATE_LIMITS.panelActions, rateLimitKey(userId));
  return attempt.success ? null : "Demasiadas acciones seguidas. Espera un momento.";
}

function revalidateKind(kind: TrashKind) {
  revalidatePath(TRASH_PATH);
  revalidatePath(trashListPath(kind), "layout");
}

const theKind = (kind: TrashKind) =>
  kind === "media" ? "La foto" : kind === "message" ? "El mensaje" : theType(kind);

/**
 * "Enviar a la papelera" for content (content.delete: editors and
 * administrators). It leaves the site at once and its photos follow.
 */
export async function trashContent(type: ContentType, id: string): Promise<TrashResult> {
  const authorized = await authorizeAction("content.delete");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!isTrashableType(type) || !z.uuid().safeParse(id).success) {
    return { ok: false, error: "Datos no válidos." };
  }
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  const supabase = await createClient();
  const { data, error } = await contentTable(supabase, type)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    return {
      ok: false,
      error:
        error.code === "42501"
          ? NOT_ALLOWED
          : "No se pudo enviar a la papelera. Vuelve a intentarlo.",
    };
  }
  if (data.length === 0) {
    return { ok: false, error: `${thisType(type)} ya está en la papelera o no existe.` };
  }

  await syncContentPhotos(supabase, type, id, { always: true });
  revalidateKind(type);
  return { ok: true };
}

/**
 * "Restaurar" (trash.restore: the Administrator). Published or scheduled
 * content comes back as a draft, to be reviewed before it is public again.
 */
export async function restoreFromTrash(kind: TrashKind, id: string): Promise<TrashResult> {
  const authorized = await authorizeAction("trash.restore");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  const parsed = trashTargetSchema.safeParse({ kind, id });
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  const supabase = await createClient();
  const target = parsed.data;

  if (target.kind === "media" || target.kind === "message") {
    const { data, error } = await supabase
      .from(target.kind === "media" ? "media" : "contact_messages")
      .update({ deleted_at: null })
      .eq("id", target.id)
      .not("deleted_at", "is", null)
      .select("id");
    if (error)
      return { ok: false, error: error.code === "42501" ? NOT_ALLOWED : "No se pudo restaurar." };
    if (data.length === 0) {
      return { ok: false, error: `${theKind(target.kind)} ya no está en la papelera.` };
    }
    // A photo may be in use by published content again
    if (target.kind === "media") await syncPublicMediaAfter([target.id]);
    revalidateKind(target.kind);
    return { ok: true };
  }

  const type = target.kind;
  const { data: current } = await contentTable(supabase, type)
    .select("status")
    .eq("id", target.id)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (!current) return { ok: false, error: `${theType(type)} ya no está en la papelera.` };

  const { error } = await contentTable(supabase, type)
    .update(
      current.status === "published" ? { deleted_at: null, status: "draft" } : { deleted_at: null },
    )
    .eq("id", target.id)
    .not("deleted_at", "is", null);
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: `Otro contenido usa ahora la misma dirección. Cambia el título de ese contenido o envíalo a la papelera antes de restaurar ${agree(type, "esta", "este")} ${CONTENT_TYPES[type].singular}.`,
      };
    }
    return { ok: false, error: error.code === "42501" ? NOT_ALLOWED : "No se pudo restaurar." };
  }

  revalidateKind(type);
  return { ok: true };
}

/**
 * "Eliminar definitivamente" (trash.purge: the Administrator), only from the
 * trash and after typing ELIMINAR. What belonged to purged content is unlinked
 * by the database; a photo still in use is not purged. The audit log keeps it.
 */
export async function purgeFromTrash(
  kind: TrashKind,
  id: string,
  confirmation: string,
): Promise<TrashResult> {
  const authorized = await authorizeAction("trash.purge");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  const parsed = purgeSchema.safeParse({ kind, id, confirmation });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  const supabase = await createClient();
  const target = parsed.data;
  let publicKey: string | null = null;

  if (target.kind === "media") {
    const uses = await photoUses(supabase, target.id);
    if (uses.length > 0) {
      const where = uses
        .map(
          (use) =>
            `${kindName(use.kind).toLowerCase()} «${use.name}»${use.inTrash ? " (en la papelera)" : ""}`,
        )
        .join(", ");
      return {
        ok: false,
        error: `La foto todavía se usa en: ${where}. Quítala de ahí antes de eliminarla.`,
      };
    }
    const { data: media } = await supabase
      .from("media")
      .select("public_key")
      .eq("id", target.id)
      .maybeSingle();
    publicKey = media?.public_key ?? null;
  }

  // RLS: trash.purge with MFA, and only rows already in the trash
  const { data, error } = await supabase
    .from(tableFor(target.kind) as "posts")
    .delete()
    .eq("id", target.id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23503"
          ? `${theKind(target.kind)} todavía se usa en otro contenido.`
          : error.code === "42501"
            ? NOT_ALLOWED
            : "No se pudo eliminar. Vuelve a intentarlo.",
    };
  }
  if (data.length === 0) {
    return { ok: false, error: `${theKind(target.kind)} ya no está en la papelera.` };
  }

  // The row is gone: its files follow. Failures leave only unlinked files.
  if (target.kind === "media") {
    await removeMediaFiles(target.id, publicKey).catch(() => undefined);
  }
  revalidateKind(target.kind);
  return { ok: true };
}
