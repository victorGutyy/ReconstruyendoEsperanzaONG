// Pure authorization rules: no Supabase, no Next.js. Unit-tested in rules.test.ts.

export const ADMIN_HOME = "/admin";
export const LOGIN_PATH = "/admin/login";
export const MFA_PATH = "/admin/mfa";
export const RECOVERY_PATH = "/admin/recuperar";

/** Panel pages that do not require a session. */
const PUBLIC_AUTH_PATHS = new Set([LOGIN_PATH, RECOVERY_PATH]);

/** Permissions as defined in docs/06 §3 (seeded by the access_control migration). */
export const PERMISSIONS = [
  "content.read",
  "content.create",
  "content.update_own",
  "media.upload",
  "content.update_any",
  "content.publish",
  "content.delete",
  "media.update",
  "consent.manage",
  "messages.read",
  "messages.manage",
  "taxonomy.manage",
  "users.manage",
  "settings.manage",
  "audit.read",
  "trash.restore",
  "trash.purge",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type Aal = "aal1" | "aal2";

export type RouteSession = { aal: Aal } | null;

export type RouteDecision = { type: "next" } | { type: "redirect"; to: string };

const SAFE_BASE = "http://internal.invalid";

function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * Accepts only internal panel paths for `?next=`, so a crafted link cannot send
 * a user to another site after signing in (open redirect, docs/05 §6).
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return null;
  // Absolute, protocol-relative and backslash tricks are rejected before parsing
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  // Control characters (tabs, new lines…) can be used to smuggle other hosts
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, SAFE_BASE);
  } catch {
    return null;
  }
  if (url.origin !== SAFE_BASE) return null;

  const pathname = normalizePath(url.pathname);
  if (pathname !== ADMIN_HOME && !pathname.startsWith(`${ADMIN_HOME}/`)) return null;
  // Sending someone back to the login or MFA screens would loop
  if (pathname === LOGIN_PATH || pathname === MFA_PATH) return null;

  return `${pathname}${url.search}`;
}

function withNext(target: string, next: string | null): string {
  return next ? `${target}?next=${encodeURIComponent(next)}` : target;
}

/**
 * Optimistic routing for /admin (src/proxy.ts). It only decides redirects;
 * Server Components and Server Actions still verify the session themselves.
 */
export function decideAdminRoute(input: {
  pathname: string;
  search?: string;
  session: RouteSession;
}): RouteDecision {
  const pathname = normalizePath(input.pathname);
  const requested = safeNextPath(`${pathname}${input.search ?? ""}`);

  if (!input.session) {
    if (PUBLIC_AUTH_PATHS.has(pathname)) return { type: "next" };
    return { type: "redirect", to: withNext(LOGIN_PATH, requested) };
  }

  if (input.session.aal === "aal1") {
    // Password only: MFA (enrollment or challenge) is mandatory before anything else
    if (pathname === MFA_PATH) return { type: "next" };
    return { type: "redirect", to: withNext(MFA_PATH, requested) };
  }

  // Full session (aal2): the sign-in screens are no longer needed
  if (pathname === LOGIN_PATH || pathname === MFA_PATH) {
    const params = new URLSearchParams(input.search ?? "");
    return { type: "redirect", to: safeNextPath(params.get("next")) ?? ADMIN_HOME };
  }

  return { type: "next" };
}

export type ProfileAccess = {
  isActive: boolean;
  permissions: readonly string[];
} | null;

/** Mirrors private.has_permission(): active profile whose role grants the permission. */
export function hasPermission(profile: ProfileAccess, permission: Permission): boolean {
  return profile !== null && profile.isActive && profile.permissions.includes(permission);
}
