"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/lib/auth/guard";
import { AUTH_CONFIRM_PATH } from "@/lib/auth/rules";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/utils/site";

import {
  type ActionState,
  changeRoleSchema,
  inviteSchema,
  type RoleKey,
  setActiveSchema,
} from "./schema";

const USERS_PATH = "/admin/usuarios";
const BANNED_UNTIL_REACTIVATED = "876000h"; // ~100 years: until an admin reactivates

async function roleId(role: RoleKey): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("roles").select("id").eq("key", role).maybeSingle();
  return data?.id ?? null;
}

/**
 * Invites a person. Order matters for the audit log (docs/06 §7):
 * 1. Supabase Auth sends the invitation (secret key: the only way to invite);
 * 2. app_metadata stores name and inviter (provisioning trigger, system actor);
 * 3. the role is assigned with the manager's own session, so the audit log
 *    records who granted it.
 */
export async function inviteUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const authorized = await authorizeAction("users.manage");
  if (!authorized.ok) return { error: authorized.error };
  const { user } = authorized.auth;

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const attempt = await getRateLimiter().limit(RATE_LIMITS.userInvites, rateLimitKey(user.id));
  if (!attempt.success) return { error: "Enviaste muchas invitaciones. Espera un rato." };

  const admin = createAdminClient();
  const invited = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${await getSiteOrigin()}${AUTH_CONFIRM_PATH}`,
  });
  if (invited.error || !invited.data.user) {
    return {
      error:
        invited.error?.code === "email_exists" || invited.error?.status === 422
          ? "Ese correo ya tiene una cuenta en el panel."
          : "No pudimos enviar la invitación. Inténtalo de nuevo.",
    };
  }

  const newUserId = invited.data.user.id;
  await admin.auth.admin.updateUserById(newUserId, {
    app_metadata: { full_name: parsed.data.fullName, invited_by: user.id },
  });

  const id = await roleId(parsed.data.role);
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role_id: id }).eq("id", newUserId);

  revalidatePath(USERS_PATH);
  if (error) {
    return {
      error: `La invitación se envió a ${parsed.data.email}, pero no se pudo asignar el rol. Asígnalo en la lista.`,
    };
  }
  return { notice: `Invitación enviada a ${parsed.data.email}.` };
}

export async function changeUserRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const authorized = await authorizeAction("users.manage");
  if (!authorized.ok) return { error: authorized.error };
  const { user } = authorized.auth;

  const parsed = changeRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Elige un rol válido." };
  if (parsed.data.userId === user.id) return { error: "No puedes cambiar tu propio rol." };

  const attempt = await getRateLimiter().limit(RATE_LIMITS.panelActions, rateLimitKey(user.id));
  if (!attempt.success) return { error: "Demasiadas acciones seguidas. Espera un momento." };

  // RLS + the guard trigger check users.manage and MFA again in the database
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role_id: await roleId(parsed.data.role) })
    .eq("id", parsed.data.userId);
  if (error) return { error: "No se pudo cambiar el rol." };

  revalidatePath(USERS_PATH);
  return { notice: "Rol actualizado." };
}

/** Deactivation also blocks the account in Supabase Auth (no new sign-ins). */
export async function setUserActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const authorized = await authorizeAction("users.manage");
  if (!authorized.ok) return { error: authorized.error };
  const { user } = authorized.auth;

  const parsed = setActiveSchema.safeParse({
    userId: formData.get("userId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return { error: "Acción no válida." };
  if (parsed.data.userId === user.id) return { error: "No puedes desactivar tu propia cuenta." };

  const attempt = await getRateLimiter().limit(RATE_LIMITS.panelActions, rateLimitKey(user.id));
  if (!attempt.success) return { error: "Demasiadas acciones seguidas. Espera un momento." };

  // First the profile (RLS + guard trigger + audit with the manager as actor)…
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: parsed.data.active })
    .eq("id", parsed.data.userId);
  if (error) return { error: "No se pudo cambiar el estado." };

  // …then Supabase Auth: a deactivated person cannot sign in again
  await createAdminClient().auth.admin.updateUserById(parsed.data.userId, {
    ban_duration: parsed.data.active ? "none" : BANNED_UNTIL_REACTIVATED,
  });

  revalidatePath(USERS_PATH);
  return { notice: parsed.data.active ? "Cuenta reactivada." : "Cuenta desactivada." };
}
