import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

/** Tests that need a real Supabase (auth) are skipped when it is not configured. */
export const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SECRET_KEY &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder"),
);

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type TestUser = { id: string; email: string; password: string; fullName: string };

/** A fresh [DEMO] user with a role, created like an invitation would (app_metadata). */
export async function createTestUser(role: "admin" | "editor" | "author" = "admin") {
  const email = `e2e-${randomUUID()}@example.test`;
  const password = `Demo-${randomUUID()}`;
  const fullName = `[DEMO] E2E ${role}`;

  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role, full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error("could not create the test user");

  return { id: data.user.id, email, password, fullName } satisfies TestUser;
}

export async function deactivate(userId: string) {
  const { error } = await adminClient()
    .from("profiles")
    .update({ is_active: false })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Each test signs in "from" its own IP, like different people. Otherwise the
 * whole suite (one machine) would hit the per-IP login limit (docs/05 §7).
 * On Vercel this header is set by the platform, not by the visitor.
 */
export function randomClientIp(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}
