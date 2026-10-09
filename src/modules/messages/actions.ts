"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/guard";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

import { isMessageStatus, type MessageStatus, MESSAGES_PATH } from "./schema";

export type MessageResult = { ok: true } | { ok: false; error: string };

const idSchema = z.uuid();
const NOT_ALLOWED = "No tienes permiso para atender mensajes.";

async function prepare(id: string) {
  const authorized = await authorizeAction("messages.manage");
  if (!authorized.ok) return { ok: false, error: authorized.error } as const;
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Mensaje no válido." } as const;
  const attempt = await getRateLimiter().limit(
    RATE_LIMITS.panelActions,
    rateLimitKey(authorized.auth.user.id),
  );
  if (!attempt.success)
    return { ok: false, error: "Demasiadas acciones seguidas. Espera un momento." } as const;
  return { ok: true, supabase: await createClient() } as const;
}

const refresh = () => revalidatePath(MESSAGES_PATH, "layout");

/** Opening a new message marks it as read (only if it was new). */
export async function markMessageRead(id: string): Promise<MessageResult> {
  const context = await prepare(id);
  if (!context.ok) return { ok: false, error: context.error };
  const { error } = await context.supabase
    .from("contact_messages")
    .update({ status: "read" })
    .eq("id", id)
    .eq("status", "new")
    .is("deleted_at", null);
  if (error) return { ok: false, error: NOT_ALLOWED };
  refresh();
  return { ok: true };
}

/** Moves a message between its states; the database records who handled it. */
export async function setMessageStatus(id: string, status: MessageStatus): Promise<MessageResult> {
  if (!isMessageStatus(status)) return { ok: false, error: "Estado no válido." };
  const context = await prepare(id);
  if (!context.ok) return { ok: false, error: context.error };
  const { data, error } = await context.supabase
    .from("contact_messages")
    .update({ status })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: NOT_ALLOWED };
  if (data.length === 0) return { ok: false, error: "El mensaje ya no está en la bandeja." };
  refresh();
  return { ok: true };
}

/** "Enviar a la papelera": the Administrator restores it or deletes it for good. */
export async function trashMessage(id: string): Promise<MessageResult> {
  const context = await prepare(id);
  if (!context.ok) return { ok: false, error: context.error };
  const { data, error } = await context.supabase
    .from("contact_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: NOT_ALLOWED };
  if (data.length === 0) return { ok: false, error: "El mensaje ya está en la papelera." };
  refresh();
  revalidatePath("/admin/papelera");
  return { ok: true };
}
