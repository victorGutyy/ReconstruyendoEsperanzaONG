import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env/public";
import { requireServerEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

// ⚠️ The secret key BYPASSES RLS. Only for the narrow cases listed in docs/06
// (inviting users, processing images, inserting contact messages after Turnstile + rate limit).
// Never use it to serve data to a user.
export function createAdminClient() {
  return createClient<Database>(
    getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
    requireServerEnv("SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
