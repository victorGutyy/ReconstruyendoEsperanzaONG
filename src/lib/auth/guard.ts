import "server-only";

import { redirect } from "next/navigation";

import { type AuthErrorCode, isAuthError } from "./errors";
import { LOGIN_PATH, MFA_PATH, type Permission } from "./rules";
import { type CurrentProfile, requirePermission, type SessionUser } from "./session";

export type Authorized = { user: SessionUser; profile: CurrentProfile };

/**
 * For Server Components: redirects to the login or MFA screen, and returns
 * `null` when the user is signed in but lacks the permission (the page then
 * shows a "no permission" message instead of the content).
 */
export async function authorizePage(permission: Permission): Promise<Authorized | null> {
  try {
    return await requirePermission(permission);
  } catch (error) {
    if (!isAuthError(error)) throw error;
    if (error.code === "UNAUTHENTICATED") redirect(LOGIN_PATH);
    if (error.code === "MFA_REQUIRED") redirect(MFA_PATH);
    return null;
  }
}

const ACTION_MESSAGES: Record<AuthErrorCode, string> = {
  UNAUTHENTICATED: "Tu sesión terminó. Vuelve a entrar.",
  MFA_REQUIRED: "Confirma tu código de verificación para continuar.",
  FORBIDDEN: "No tienes permiso para hacer esto.",
};

/**
 * For Server Actions: returns the authorized user or a generic, user-facing
 * error message (never internal details, docs/05 §12 A10).
 */
export async function authorizeAction(
  permission: Permission,
): Promise<{ ok: true; auth: Authorized } | { ok: false; error: string }> {
  try {
    return { ok: true, auth: await requirePermission(permission) };
  } catch (error) {
    if (!isAuthError(error)) throw error;
    return { ok: false, error: ACTION_MESSAGES[error.code] };
  }
}
