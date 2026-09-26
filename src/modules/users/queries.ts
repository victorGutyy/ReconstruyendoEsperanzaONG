import "server-only";

import { createClient } from "@/lib/supabase/server";

export type TeamMember = {
  id: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
  roleKey: string | null;
  roleName: string | null;
  invitedBy: string | null;
  createdAt: string;
};

/**
 * The whole team, read through RLS: only users.manage + MFA can see profiles
 * other than their own (docs/06 §10). Call after authorizePage('users.manage').
 */
export async function listTeam(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active, created_at, invited_by, roles(key, name)")
    .order("created_at", { ascending: true });

  if (error) throw error;

  // The inviter is also a member of the team already loaded
  const names = new Map(data.map((row) => [row.id, row.full_name]));

  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    isActive: row.is_active,
    roleKey: row.roles?.key ?? null,
    roleName: row.roles?.name ?? null,
    invitedBy: row.invited_by ? (names.get(row.invited_by) ?? null) : null,
    createdAt: row.created_at,
  }));
}
