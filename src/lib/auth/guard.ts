import "server-only";

import { redirect } from "next/navigation";

import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";

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

export const TOO_MANY_ACTIONS = "Demasiadas acciones seguidas. Espera un momento.";

/**
 * For Server Actions: returns the authorized user or a generic, user-facing
 * error message (never internal details, docs/05 §12 A10). Every panel action
 * goes through here, so here is also the per-user limit of docs/05 §7 (step
 * 9.2): no action can forget it.
 */
export async function authorizeAction(
  permission: Permission,
): Promise<{ ok: true; auth: Authorized } | { ok: false; error: string }> {
  let auth: Authorized;
  try {
    auth = await requirePermission(permission);
  } catch (error) {
    if (!isAuthError(error)) throw error;
    return { ok: false, error: ACTION_MESSAGES[error.code] };
  }
  const attempt = await getRateLimiter().limit(
    RATE_LIMITS.panelActions,
    rateLimitKey(auth.user.id),
  );
  if (!attempt.success) return { ok: false, error: TOO_MANY_ACTIONS };
  return { ok: true, auth };
}
