import "server-only";

import { revalidatePublicSite } from "@/lib/site/revalidate";
import type { createClient } from "@/lib/supabase/server";
import { getMediaCards, getPublishIssues, syncPublicMedia } from "@/modules/media";

import type { CoverInfo } from "./components/cover-field";

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
 * content that is not published unless `always` (a state change). The public
 * site is refreshed too, so visitors see the change at once (step 8.2).
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
  revalidatePublicSite();

  const { data: usages } = await supabase
    .from("content_media_usages")
    .select("media_id")
    .eq("entity_type", type)
    .eq("entity_id", id);
  const ids = new Set(extra);
  for (const usage of usages ?? []) if (usage.media_id) ids.add(usage.media_id);
  await syncPublicMedia([...ids]).catch(() => undefined);
}

/**
 * After an edit that does not touch photos (text, tags, order, captions):
 * refreshes the public site only if visitors can see this content.
 */
export async function refreshPublicIfPublished(supabase: Supabase, type: ContentType, id: string) {
  const { data: item } = await contentTable(supabase, type)
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (item?.status === "published") revalidatePublicSite();
}

/** The cover with its preview and what it still needs, or null without cover. */
export async function getContentCover(mediaId: string | null): Promise<CoverInfo | null> {
  if (!mediaId) return null;
  const [cards, issues] = await Promise.all([
    getMediaCards([mediaId]),
    getPublishIssues([mediaId]),
  ]);
  return {
    mediaId,
    altText: cards[0]?.altText ?? null,
    thumbnailUrl: cards[0]?.thumbnailUrl ?? null,
    issues: issues.get(mediaId) ?? [],
  };
}
