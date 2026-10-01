"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/guard";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

import { contentTable, syncContentPhotos } from "./media";
import {
  agree,
  CONTENT_TYPES,
  type ContentType,
  isContentType,
  STATUS_CHANGES,
  type StatusChange,
  theType,
} from "./registry";
import { optionalNoteSchema, reviewNoteSchema } from "./schema";

export type StatusResult = { ok: true } | { ok: false; error: string };

const stale = (type: ContentType, change: StatusChange) =>
  ({
    returned: "ya no está en revisión.",
    retired: `ya no está ${agree(type, "publicada", "publicado")}.`,
    archived: `ya no está ${agree(type, "publicada", "publicado")}.`,
    reopened: `ya no está ${agree(type, "archivada", "archivado")}.`,
  })[change];

/**
 * Editor actions on the state of any content (steps 7.4b and 7.6a): return
 * from review with a required note, retire published content to fix it
 * (optional note), archive, reopen. The database checks the transition, the
 * permission and the note again; public photos follow.
 */
export async function changeContentStatus(
  type: ContentType,
  id: string,
  change: StatusChange,
  note?: string,
): Promise<StatusResult> {
  const authorized = await authorizeAction("content.publish");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (
    !isContentType(type) ||
    !z.uuid().safeParse(id).success ||
    !Object.hasOwn(STATUS_CHANGES, change)
  ) {
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

  const attempt = await getRateLimiter().limit(
    RATE_LIMITS.panelActions,
    rateLimitKey(authorized.auth.user.id),
  );
  if (!attempt.success) {
    return { ok: false, error: "Demasiadas acciones seguidas. Espera un momento." };
  }

  const { from, to } = STATUS_CHANGES[change];
  const supabase = await createClient();
  const { data, error } = await contentTable(supabase, type)
    .update(reviewNote ? { status: to, review_note: reviewNote } : { status: to })
    .eq("id", id)
    .eq("status", from)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    return {
      ok: false,
      error:
        error.code === "42501"
          ? "No tienes permiso para hacer esto."
          : "No se pudo cambiar el estado. Vuelve a intentarlo.",
    };
  }
  if (data.length === 0) return { ok: false, error: `${theType(type)} ${stale(type, change)}` };

  await syncContentPhotos(supabase, type, id, { always: true });
  revalidatePath(CONTENT_TYPES[type].listPath, "layout");
  return { ok: true };
}
