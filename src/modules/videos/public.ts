import "server-only";

import { unstable_cache } from "next/cache";

import { PUBLIC_CONTENT_TAG } from "@/lib/site/revalidate";
import { createPublicClient } from "@/lib/supabase/public";
import { type PublicMediaRow, type PublicPhoto, toPublicPhoto } from "@/modules/media";

import { embedUrl, type Provider, PROVIDER_LABELS, watchUrl } from "./parse";

// What visitors see of videos (step 8.4). Read as an anonymous visitor: only
// published videos and public photos. No page of their own (decision 7.6c):
// each one is a card. Cached 5 minutes; revalidatePublicSite() clears it.

const cached = <Args extends unknown[], Result>(
  name: string,
  fn: (...args: Args) => Promise<Result>,
) => unstable_cache(fn, ["public-videos", name], { tags: [PUBLIC_CONTENT_TAG], revalidate: 300 });

const COLUMNS =
  "id, title, description, provider, provider_video_id, published_at, cover:media!videos_cover_media_id_fkey(public_key, width, height, alt_text)";

type Row = {
  id: string;
  title: string;
  description: string | null;
  provider: Provider;
  provider_video_id: string;
  published_at: string;
  cover: PublicMediaRow | null;
};

export type PublicVideo = {
  id: string;
  title: string;
  description: string | null;
  providerLabel: string;
  /** The player, loaded only when the visitor asks; null = link only (Facebook). */
  embed: string | null;
  /** The video on the provider's own site. */
  watch: string;
  publishedAt: string;
  cover: PublicPhoto | null;
};

const toVideo = (row: Row): PublicVideo => ({
  id: row.id,
  title: row.title,
  description: row.description,
  providerLabel: PROVIDER_LABELS[row.provider],
  embed: embedUrl(row.provider, row.provider_video_id),
  watch: watchUrl(row.provider, row.provider_video_id),
  publishedAt: row.published_at,
  cover: toPublicPhoto(row.cover),
});

/** Published videos, newest first; of one activity or project when given. */
export const listPublicVideos = cached(
  "list",
  async (owner?: { activityId?: string; projectId?: string }): Promise<PublicVideo[]> => {
    let query = createPublicClient().from("videos").select(COLUMNS);
    if (owner?.activityId) query = query.eq("activity_id", owner.activityId);
    if (owner?.projectId) query = query.eq("project_id", owner.projectId);
    const { data, error } = await query.order("published_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as Row[]).map(toVideo);
  },
);
