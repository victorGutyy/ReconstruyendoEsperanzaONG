import "server-only";

import { randomUUID } from "node:crypto";

import { MEDIA_WIDTHS, type MediaSize } from "@/lib/images/process";
import type { PublicStorage } from "@/lib/storage/types";
import { supabasePrivateStorage, supabasePublicStorage } from "@/lib/storage/supabase";
import { createAdminClient } from "@/lib/supabase/admin";

import { mediaPaths } from "./schema";

// Public photos (step 7.5a, docs/04 §5.3). The database decides which photos
// must be public (public.media_public_targets); this makes the public bucket
// match. Idempotent: running it twice changes nothing. It can only publish
// what the rule allows, so callers just need to have authorized their action.

const SIZES = Object.keys(MEDIA_WIDTHS) as MediaSize[];
/** Ids per call to the database rule. */
const CHUNK = 500;
/** Photos copied or removed at the same time. */
const CONCURRENCY = 3;

export const publicKeyFor = (prefix: string, size: MediaSize) => `${prefix}/${size}.webp`;

export type SyncReport = { published: number; withdrawn: number; failed: string[] };

/** Copies the processed versions under a new random key, then records it. */
async function publish(mediaId: string, storage: PublicStorage): Promise<boolean> {
  const prefix = randomUUID();
  const keys = SIZES.map((size) => publicKeyFor(prefix, size));
  try {
    const files = await Promise.all(
      SIZES.map((size) =>
        supabasePrivateStorage().download("media-private", mediaPaths.variant(mediaId, size)),
      ),
    );
    if (files.some((file) => file === null)) return false;
    await Promise.all(files.map((file, index) => storage.put(keys[index]!, file!, "image/webp")));

    // Only if nobody published it meanwhile
    const { data, error } = await createAdminClient()
      .from("media")
      .update({ public_key: prefix })
      .eq("id", mediaId)
      .is("public_key", null)
      .select("id");
    if (error) throw error;
    // Another run published it first: keep theirs, drop these copies
    if (data.length === 0) await storage.remove(keys);
    return true;
  } catch {
    await storage.remove(keys).catch(() => undefined);
    return false;
  }
}

/** The site stops linking it first, then the files go away. */
async function withdraw(mediaId: string, prefix: string, storage: PublicStorage) {
  const { data, error } = await createAdminClient()
    .from("media")
    .update({ public_key: null })
    .eq("id", mediaId)
    .eq("public_key", prefix)
    .select("id");
  if (error) return false;
  // Someone else changed it: their run removes their files
  if (data.length === 0) return true;
  try {
    await storage.remove(SIZES.map((size) => publicKeyFor(prefix, size)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Makes the public copies match the rule for these photos, or for every
 * photo in use or still public when `mediaIds` is omitted (daily sync).
 */
export async function syncPublicMedia(mediaIds?: string[]): Promise<SyncReport> {
  const report: SyncReport = { published: 0, withdrawn: 0, failed: [] };
  if (mediaIds && mediaIds.length === 0) return report;

  const admin = createAdminClient();
  const targets: { media_id: string; public_key: string | null; should_be_public: boolean }[] = [];
  const chunks = mediaIds
    ? Array.from({ length: Math.ceil(mediaIds.length / CHUNK) }, (_, index) =>
        mediaIds.slice(index * CHUNK, (index + 1) * CHUNK),
      )
    : [undefined];
  for (const chunk of chunks) {
    const { data, error } = await admin.rpc(
      "media_public_targets",
      chunk ? { p_media_ids: chunk } : {},
    );
    if (error) throw error;
    targets.push(...data);
  }

  const work = targets.filter((target) => target.should_be_public !== (target.public_key !== null));
  const storage = supabasePublicStorage();
  for (let start = 0; start < work.length; start += CONCURRENCY) {
    await Promise.all(
      work.slice(start, start + CONCURRENCY).map(async (target) => {
        const ok = target.should_be_public
          ? await publish(target.media_id, storage)
          : await withdraw(target.media_id, target.public_key!, storage);
        if (!ok) report.failed.push(target.media_id);
        else if (target.should_be_public) report.published += 1;
        else report.withdrawn += 1;
      }),
    );
  }
  return report;
}
