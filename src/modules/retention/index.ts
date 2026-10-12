import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { withdrawStalledUploads } from "@/modules/media";

// Daily retention (step 9.3, docs/09 §3): contact messages after 12 months,
// audit entries after 2 years (both in public.run_retention), and uploads
// left halfway. Counts only: never personal data.

export type CleanupReport = { messages: number; audit: number; uploads: number };

export async function runDailyCleanup(): Promise<CleanupReport> {
  const { data, error } = await createAdminClient().rpc("run_retention");
  if (error) throw error;
  const purged = data as { messages: number; audit: number };
  const uploads = await withdrawStalledUploads();
  return { messages: purged.messages, audit: purged.audit, uploads };
}
