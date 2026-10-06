import "server-only";

import { unstable_cache } from "next/cache";

import type { RichTextDoc } from "@/lib/rich-text/schema";
import { PUBLIC_CONTENT_TAG } from "@/lib/site/revalidate";
import { createPublicClient } from "@/lib/supabase/public";
import { type PublicPhoto, toPublicPhoto } from "@/modules/media";

import {
  PAST_PAGE_SIZE,
  type PublicActivityFilters,
  yearBounds,
  yearInColombia,
} from "./public-filters";

// What visitors see of activities (step 8.2). Read as an anonymous visitor:
// the RLS returns only published activities whose date arrived and only
// public photos. Cached 5 minutes; revalidatePublicSite() clears it at once.

const cached = <Args extends unknown[], Result>(
  name: string,
  fn: (...args: Args) => Promise<Result>,
) =>
  unstable_cache(fn, ["public-activities", name], { tags: [PUBLIC_CONTENT_TAG], revalidate: 300 });

type Named = { name: string; slug: string } | null;
type MediaRow = {
  public_key: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
} | null;

const CARD_COLUMNS =
  "id, slug, title, summary, starts_at, ends_at, place:places(name, slug), category:categories(name, slug), cover:media!activities_cover_media_id_fkey(public_key, width, height, alt_text)";

type CardRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  starts_at: string;
  ends_at: string | null;
  place: Named;
  category: Named;
  cover: MediaRow;
};

export type ActivityCard = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  startsAt: string;
  endsAt: string | null;
  place: string | null;
  category: string | null;
  cover: PublicPhoto | null;
};

const toCard = (row: CardRow): ActivityCard => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  place: row.place?.name ?? null,
  category: row.category?.name ?? null,
  cover: toPublicPhoto(row.cover),
});

export type FilterOption = { value: string; label: string };
export type ActivityFacets = {
  years: number[];
  categories: FilterOption[];
  places: FilterOption[];
};

/** Years, categories and places that have published activities (filter options). */
export const getActivityFacets = cached("facets", async (): Promise<ActivityFacets> => {
  const { data, error } = await createPublicClient()
    .from("activities")
    .select("starts_at, place:places(name, slug), category:categories(name, slug)");
  if (error) throw error;
  const rows = data as unknown as { starts_at: string; place: Named; category: Named }[];
  const options = (pick: (row: (typeof rows)[number]) => Named) =>
    [
      ...new Map(
        rows.flatMap((row) => {
          const named = pick(row);
          return named ? [[named.slug, named.name] as const] : [];
        }),
      ),
    ]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  return {
    years: [...new Set(rows.map((row) => yearInColombia(row.starts_at)))].sort((a, b) => b - a),
    categories: options((row) => row.category),
    places: options((row) => row.place),
  };
});

/** Ids of the category and place named in the address (null = filter not found). */
async function resolveFilters(filters: PublicActivityFilters) {
  const supabase = createPublicClient();
  const [category, place] = await Promise.all([
    filters.category
      ? supabase
          .from("categories")
          .select("id")
          .eq("scope", "activity")
          .eq("slug", filters.category)
          .maybeSingle()
      : null,
    filters.place
      ? supabase.from("places").select("id").eq("slug", filters.place).maybeSingle()
      : null,
  ]);
  return {
    categoryId: filters.category ? (category?.data?.id ?? false) : null,
    placeId: filters.place ? (place?.data?.id ?? false) : null,
  };
}

export type ActivityListing = {
  upcoming: ActivityCard[];
  past: ActivityCard[];
  pastTotal: number;
  pageCount: number;
};

/**
 * Upcoming activities (soonest first) and past ones (newest first, paged).
 * "Now" is the moment the cached result is built: at most 5 minutes old.
 */
export const listPublicActivities = cached(
  "listing",
  async (filters: PublicActivityFilters): Promise<ActivityListing> => {
    const empty = { upcoming: [], past: [], pastTotal: 0, pageCount: 0 };
    const resolved = await resolveFilters(filters);
    // A category or place that does not exist (or was removed) matches nothing
    if (resolved.categoryId === false || resolved.placeId === false) return empty;
    const { categoryId, placeId } = resolved as {
      categoryId: string | null;
      placeId: string | null;
    };
    const range = filters.year ? yearBounds(filters.year) : null;

    const now = new Date().toISOString();
    const supabase = createPublicClient();
    const query = (options?: { count: "exact" }) => {
      let next = supabase.from("activities").select(CARD_COLUMNS, options);
      if (categoryId) next = next.eq("category_id", categoryId);
      if (placeId) next = next.eq("place_id", placeId);
      if (range) next = next.gte("starts_at", range.from).lt("starts_at", range.to);
      return next;
    };

    const offset = (filters.page - 1) * PAST_PAGE_SIZE;
    const [upcoming, past] = await Promise.all([
      query().gte("starts_at", now).order("starts_at", { ascending: true }),
      query({ count: "exact" })
        .lt("starts_at", now)
        .order("starts_at", { ascending: false })
        .range(offset, offset + PAST_PAGE_SIZE - 1),
    ]);
    if (upcoming.error) throw upcoming.error;
    // Asking for a page past the end is not an error: it is empty
    if (past.error && past.error.code !== "PGRST103") throw past.error;

    const pastTotal = past.count ?? 0;
    return {
      upcoming: (upcoming.data as unknown as CardRow[]).map(toCard),
      past: past.error ? [] : (past.data as unknown as CardRow[]).map(toCard),
      pastTotal,
      pageCount: Math.ceil(pastTotal / PAST_PAGE_SIZE),
    };
  },
);

export type PublicActivity = ActivityCard & {
  body: RichTextDoc | null;
  results: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string;
  categorySlug: string | null;
  categoryId: string | null;
  project: string | null;
  tags: string[];
  photos: (PublicPhoto & { caption: string | null })[];
};

/** One published activity by its address, or null (404). */
export const getPublicActivity = cached(
  "detail",
  async (slug: string): Promise<PublicActivity | null> => {
    const { data, error } = await createPublicClient()
      .from("activities")
      .select(
        `${CARD_COLUMNS}, body, results, seo_title, seo_description, published_at, category_id, project:projects(title), activity_tags(tags(name)), activity_media(position, caption, media(public_key, width, height, alt_text, caption))`,
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const row = data as unknown as CardRow & {
      body: RichTextDoc | null;
      results: string | null;
      seo_title: string | null;
      seo_description: string | null;
      published_at: string;
      category_id: string | null;
      project: { title: string } | null;
      activity_tags: { tags: { name: string } | null }[];
      activity_media: {
        position: number;
        caption: string | null;
        media: (NonNullable<MediaRow> & { caption: string | null }) | null;
      }[];
    };

    return {
      ...toCard(row),
      body: row.body,
      results: row.results,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      publishedAt: row.published_at,
      categorySlug: row.category?.slug ?? null,
      categoryId: row.category_id,
      project: row.project?.title ?? null,
      tags: row.activity_tags.flatMap((link) => (link.tags ? [link.tags.name] : [])),
      // Photos that lost their authorization are not public: they are left out
      photos: [...row.activity_media]
        .sort((a, b) => a.position - b.position)
        .flatMap((link) => {
          const photo = toPublicPhoto(link.media);
          return photo ? [{ ...photo, caption: link.caption ?? link.media?.caption ?? null }] : [];
        }),
    };
  },
);

/** Up to three other activities of the same category, newest first. */
export const listRelatedActivities = cached(
  "related",
  async (activityId: string, categoryId: string | null): Promise<ActivityCard[]> => {
    if (!categoryId) return [];
    const { data, error } = await createPublicClient()
      .from("activities")
      .select(CARD_COLUMNS)
      .eq("category_id", categoryId)
      .neq("id", activityId)
      .order("starts_at", { ascending: false })
      .limit(3);
    if (error) throw error;
    return (data as unknown as CardRow[]).map(toCard);
  },
);
