import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env/public";

// Browser client: publishable key only, every query is limited by RLS.
export function createClient() {
  const env = getPublicEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
