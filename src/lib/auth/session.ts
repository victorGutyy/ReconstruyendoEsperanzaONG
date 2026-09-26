import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { AuthError } from "./errors";
import { type Aal, hasPermission, type Permission } from "./rules";

// Data Access Layer: the real authorization barrier (docs/05 §5.1). src/proxy.ts
// only redirects; every Server Component and Server Action calls these itself.

export type SessionUser = {
  id: string;
  email: string | null;
  aal: Aal;
};

export type CurrentProfile = {
  id: string;
  fullName: string;
  isActive: boolean;
  roleKey: string | null;
  permissions: string[];
};

/**
 * The signed-in user, verified with getClaims() (validates the JWT), never with
 * getSession() alone. Memoized per request.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
  };
});

/**
 * The user's own profile and permissions. Reads through RLS (a user can read
 * their own profile and the permission matrix), because private.has_permission()
 * is not exposed by the Data API. Memoized per request.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const user = await getSession();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, is_active, roles(key, role_permissions(permission_key))")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    isActive: data.is_active,
    roleKey: data.roles?.key ?? null,
    permissions: data.roles?.role_permissions.map((rp) => rp.permission_key) ?? [],
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new AuthError("UNAUTHENTICATED");
  return user;
}

export async function requireAal2(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.aal !== "aal2") throw new AuthError("MFA_REQUIRED");
  return user;
}

/**
 * First step of every Server Action (docs/04 §4.2):
 * user → MFA (aal2) → permission. Then Zod, rate limit and the query (RLS checks again).
 */
export async function requirePermission(
  permission: Permission,
): Promise<{ user: SessionUser; profile: CurrentProfile }> {
  const user = await requireAal2();
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, permission)) throw new AuthError("FORBIDDEN");
  return { user, profile };
}
