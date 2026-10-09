import "server-only";

import { unstable_cache } from "next/cache";

import { PUBLIC_CONTENT_TAG } from "@/lib/site/revalidate";
import { createPublicClient } from "@/lib/supabase/public";
import { type PublicMediaRow, type PublicPhoto, toPublicPhoto } from "@/modules/media";

import type { MemoryKind } from "./schema";

// Memoria (step 8.6, RF-A-08): everything done, by year, from the
// public_timeline view (it only lets published content through).

export type MemoryItem = {
  kind: MemoryKind;
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  eventAt: string;
  place: string | null;
  photo: PublicPhoto | null;
};

export type MemoryYear = { year: number; items: MemoryItem[] };

/** Every year with its items, newest first; only one kind when given. */
export const listMemory = unstable_cache(
  async (kind: MemoryKind | null): Promise<MemoryYear[]> => {
    const supabase = createPublicClient();
    let query = supabase
      .from("public_timeline")
      .select("entity_type, id, title, slug, summary, cover_media_id, event_at, year, place_name");
    if (kind) query = query.eq("entity_type", kind);
    const { data, error } = await query.order("event_at", { ascending: false });
    if (error) throw error;

    // Covers: a visitor only reads the photos that are public
    const coverIds = [
      ...new Set(data.flatMap((row) => (row.cover_media_id ? [row.cover_media_id] : []))),
    ];
    const covers = new Map<string, PublicMediaRow>();
    if (coverIds.length > 0) {
      const { data: media, error: mediaError } = await supabase
        .from("media")
        .select("id, public_key, width, height, alt_text")
        .in("id", coverIds);
      if (mediaError) throw mediaError;
      for (const row of media) covers.set(row.id, row);
    }

    const years = new Map<number, MemoryItem[]>();
    for (const row of data) {
      if (!row.id || !row.year || !row.event_at || !row.title || !row.slug) continue;
      const items = years.get(row.year) ?? [];
      items.push({
        kind: row.entity_type as MemoryKind,
        id: row.id,
        title: row.title,
        slug: row.slug,
        summary: row.summary,
        eventAt: row.event_at,
        place: row.place_name,
        photo: toPublicPhoto(row.cover_media_id ? covers.get(row.cover_media_id) : null),
      });
      years.set(row.year, items);
    }
    return [...years].sort(([a], [b]) => b - a).map(([year, items]) => ({ year, items }));
  },
  ["public-memory", "list"],
  { tags: [PUBLIC_CONTENT_TAG], revalidate: 300 },
);
