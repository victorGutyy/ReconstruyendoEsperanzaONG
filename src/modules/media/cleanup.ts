import "server-only";

import { supabasePrivateStorage } from "@/lib/storage/supabase";
import { createAdminClient } from "@/lib/supabase/admin";

import { mediaPaths } from "./schema";

// Uploads left halfway (step 9.3, docs/04): the app was closed while a photo
// went up, or processing failed and nobody retried. Withdrawn like the
// "Quitar" button does: the row goes to the trash and the original is removed.

const HOUR = 60 * 60 * 1000;
/** Still "processing" after a day: it will never finish. */
export const STALLED_PROCESSING_MS = 24 * HOUR;
/** "Failed": a week for the person to see it and press "Reintentar". */
export const STALLED_FAILED_MS = 7 * 24 * HOUR;

/** The PostgREST filter for uploads past their term. Pure: tested. */
export function stalledUploadsFilter(now: Date): string {
  const processing = new Date(now.getTime() - STALLED_PROCESSING_MS).toISOString();
  const failed = new Date(now.getTime() - STALLED_FAILED_MS).toISOString();
  return (
    `and(processing_status.eq.processing,created_at.lt.${processing}),` +
    `and(processing_status.eq.failed,created_at.lt.${failed})`
  );
}

/** Withdraws stalled uploads; returns how many. */
export async function withdrawStalledUploads(now = new Date()): Promise<number> {
  const { data, error } = await createAdminClient()
    .from("media")
    .update({ deleted_at: now.toISOString() })
    .is("deleted_at", null)
    .or(stalledUploadsFilter(now))
    .select("id");
  if (error) throw error;
  if (data.length > 0) {
    await supabasePrivateStorage()
      .remove(
        "media-incoming",
        data.map((row) => mediaPaths.incoming(row.id)),
      )
      .catch(() => undefined);
  }
  return data.length;
}
