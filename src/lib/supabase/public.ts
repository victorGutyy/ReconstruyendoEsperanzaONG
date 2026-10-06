import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database";

// The public site reads as an anonymous visitor (step 8.1): no cookies, the
// publishable key, and the RLS returns only what is published. Pages that use
// it can be cached, and no private data can ever end up in them.
export function createPublicClient() {
  return createClient<Database>(
    getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
    getPublicEnv().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
}
