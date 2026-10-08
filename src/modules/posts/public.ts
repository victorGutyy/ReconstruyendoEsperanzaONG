import "server-only";

import { unstable_cache } from "next/cache";

import type { RichTextDoc } from "@/lib/rich-text/schema";
import { PUBLIC_CONTENT_TAG } from "@/lib/site/revalidate";
import { createPublicClient } from "@/lib/supabase/public";
import { type PublicMediaRow, type PublicPhoto, toPublicPhoto } from "@/modules/media";

import { POSTS_PAGE_SIZE, type PublicPostFilters } from "./public-filters";

// What visitors see of stories (step 8.3). Read as an anonymous visitor: the
// RLS returns only published stories whose date arrived and public photos.
// Cached 5 minutes; revalidatePublicSite() clears it at once.

const cached = <Args extends unknown[], Result>(
  name: string,
  fn: (...args: Args) => Promise<Result>,
) => unstable_cache(fn, ["public-posts", name], { tags: [PUBLIC_CONTENT_TAG], revalidate: 300 });

type Named = { name: string; slug: string } | null;

const CARD_COLUMNS =
  "id, slug, title, excerpt, byline, published_at, category:categories(name, slug), cover:media!posts_cover_media_id_fkey(public_key, width, height, alt_text)";

type CardRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  byline: string | null;
  published_at: string;
  category: Named;
  cover: PublicMediaRow | null;
};

export type PostCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  /** The public signature; never the internal author (decision 8.3). */
  byline: string | null;
  publishedAt: string;
  category: string | null;
  cover: PublicPhoto | null;
};

const toCard = (row: CardRow): PostCard => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  excerpt: row.excerpt,
  byline: row.byline,
  publishedAt: row.published_at,
  category: row.category?.name ?? null,
  cover: toPublicPhoto(row.cover),
});

export type CategoryOption = { slug: string; name: string };

/** Story categories that have published stories (filter links). */
export const getPostCategories = cached("categories", async (): Promise<CategoryOption[]> => {
  const { data, error } = await createPublicClient()
    .from("posts")
    .select("category:categories(name, slug, position)");
  if (error) throw error;
  const rows = data as unknown as { category: (Named & { position: number }) | null }[];
  const unique = new Map<string, { name: string; position: number }>();
  for (const row of rows) {
    if (row.category) unique.set(row.category.slug, row.category);
  }
  return [...unique]
    .sort(([, a], [, b]) => a.position - b.position || a.name.localeCompare(b.name, "es"))
    .map(([slug, { name }]) => ({ slug, name }));
});

export type PostListing = { posts: PostCard[]; total: number; pageCount: number };

/** Newest first, a page at a time, optionally of one category. */
export const listPublicPosts = cached(
  "listing",
  async (filters: PublicPostFilters): Promise<PostListing> => {
    const supabase = createPublicClient();
    let categoryId: string | null = null;
    if (filters.category) {
      const { data } = await supabase
        .from("categories")
        .select("id")
        .eq("scope", "post")
        .eq("slug", filters.category)
        .maybeSingle();
      // A category that does not exist (or was removed) matches nothing
      if (!data) return { posts: [], total: 0, pageCount: 0 };
      categoryId = data.id;
    }

    const offset = (filters.page - 1) * POSTS_PAGE_SIZE;
    let query = supabase.from("posts").select(CARD_COLUMNS, { count: "exact" });
    if (categoryId) query = query.eq("category_id", categoryId);
    const { data, error, count } = await query
      .order("published_at", { ascending: false })
      .range(offset, offset + POSTS_PAGE_SIZE - 1);
    // Asking for a page past the end is not an error: it is empty
    if (error && error.code !== "PGRST103") throw error;

    const total = count ?? 0;
    return {
      posts: error ? [] : (data as unknown as CardRow[]).map(toCard),
      total,
      pageCount: Math.ceil(total / POSTS_PAGE_SIZE),
    };
  },
);

export type PublicPost = PostCard & {
  body: RichTextDoc | null;
  seoTitle: string | null;
  seoDescription: string | null;
  categorySlug: string | null;
  categoryId: string | null;
  tags: string[];
};

/** One published story by its address, or null (404). */
export const getPublicPost = cached("detail", async (slug: string): Promise<PublicPost | null> => {
  const { data, error } = await createPublicClient()
    .from("posts")
    .select(`${CARD_COLUMNS}, body, seo_title, seo_description, category_id, post_tags(tags(name))`)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as CardRow & {
    body: RichTextDoc | null;
    seo_title: string | null;
    seo_description: string | null;
    category_id: string | null;
    post_tags: { tags: { name: string } | null }[];
  };
  return {
    ...toCard(row),
    body: row.body,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    categorySlug: row.category?.slug ?? null,
    categoryId: row.category_id,
    tags: row.post_tags
      .flatMap((link) => (link.tags ? [link.tags.name] : []))
      .sort((a, b) => a.localeCompare(b, "es")),
  };
});

/** Up to three other stories of the same category, newest first. */
export const listRelatedPosts = cached(
  "related",
  async (postId: string, categoryId: string | null): Promise<PostCard[]> => {
    if (!categoryId) return [];
    const { data, error } = await createPublicClient()
      .from("posts")
      .select(CARD_COLUMNS)
      .eq("category_id", categoryId)
      .neq("id", postId)
      .order("published_at", { ascending: false })
      .limit(3);
    if (error) throw error;
    return (data as unknown as CardRow[]).map(toCard);
  },
);
