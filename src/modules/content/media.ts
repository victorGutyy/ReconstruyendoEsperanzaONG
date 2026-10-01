import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { syncPublicMedia } from "@/modules/media";

import { CONTENT_TYPES, type ContentType } from "./registry";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * The content tables share the engine columns (status, cover, review note,
 * trash); typing them as one of them is enough for those columns.
 */
export const contentTable = (supabase: Supabase, type: ContentType) =>
  supabase.from(CONTENT_TYPES[type].table as "posts");

/**
 * Public copies of the photos follow the content (step 7.5a): every photo it
 * uses (cover, gallery…) plus `extra` (e.g. one just removed). Runs after the
 * action succeeded and never undoes it (the daily sync retries). Skipped for
 * content that is not published unless `always` (a state change).
 */
export async function syncContentPhotos(
  supabase: Supabase,
  type: ContentType,
  id: string,
  { extra = [], always = false }: { extra?: string[]; always?: boolean } = {},
) {
  const { data: item } = await contentTable(supabase, type)
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!item || (!always && item.status !== "published")) return;

  const { data: usages } = await supabase
    .from("content_media_usages")
    .select("media_id")
    .eq("entity_type", type)
    .eq("entity_id", id);
  const ids = new Set(extra);
  for (const usage of usages ?? []) if (usage.media_id) ids.add(usage.media_id);
  await syncPublicMedia([...ids]).catch(() => undefined);
}
