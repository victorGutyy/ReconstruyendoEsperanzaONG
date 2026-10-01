import "server-only";

import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/utils/like";
import type { ContentStatus } from "@/modules/content";
import { getMediaCards, getPublishIssues } from "@/modules/media";

import { type PostFilters, POSTS_PAGE_SIZE } from "./list";

export type PostSummary = {
  id: string;
  title: string;
  status: ContentStatus;
  publishedAt: string | null;
  updatedAt: string;
  isMine: boolean;
  categoryName: string | null;
  /** Published with a cover that is no longer publishable (step 7.5b). */
  coverWithdrawn: boolean;
};

const SUMMARY_COLUMNS =
  "id, title, status, published_at, updated_at, created_by, cover_media_id, category:categories(name)";

/** One page of the panel list, newest changes first. */
export async function listPosts(
  filters: PostFilters,
  userId: string,
): Promise<{ items: PostSummary[]; total: number; pageCount: number }> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("posts")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .is("deleted_at", null);
  if (filters.status === "scheduled") {
    query = query.eq("status", "published").gt("published_at", now);
  } else if (filters.status === "published") {
    query = query.eq("status", "published").lte("published_at", now);
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.q) query = query.ilike("title", `%${escapeLike(filters.q)}%`);
  if (filters.mine) query = query.eq("created_by", userId);

  const offset = (filters.page - 1) * POSTS_PAGE_SIZE;
  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .order("id")
    .range(offset, offset + POSTS_PAGE_SIZE - 1);
  if (error && error.code !== "PGRST103") throw error;

  const rows = error ? [] : data;
  const covers = rows
    .filter((row) => row.status === "published" && row.cover_media_id)
    .map((row) => row.cover_media_id!);
  const issues = await getPublishIssues(covers);
  const total = count ?? 0;
  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      isMine: row.created_by === userId,
      categoryName: row.category?.name ?? null,
      coverWithdrawn:
        row.status === "published" &&
        row.cover_media_id !== null &&
        (issues.get(row.cover_media_id) ?? []).length > 0,
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / POSTS_PAGE_SIZE)),
  };
}

/** Counts for the dashboard and the "Por revisar" tab. */
export async function countPosts(userId: string) {
  const supabase = await createClient();
  const live = () =>
    supabase.from("posts").select("id", { count: "exact", head: true }).is("deleted_at", null);
  const results = await Promise.all([
    live().eq("status", "review"),
    live().eq("status", "draft").eq("created_by", userId),
  ]);
  const [toReview, myDrafts] = results.map(({ count, error }) => {
    if (error) throw error;
    return count ?? 0;
  });
  return { toReview: toReview!, myDrafts: myDrafts! };
}

export type PostForEditor = {
  id: string;
  status: ContentStatus;
  publishedAt: string | null;
  title: string;
  excerpt: string | null;
  body: unknown;
  categoryId: string | null;
  byline: string | null;
  coverMediaId: string | null;
  createdBy: string | null;
  updatedAt: string;
  inTrash: boolean;
  reviewNote: { text: string; at: string | null } | null;
};

/** One story, or null when RLS hides it. */
export async function getPost(id: string): Promise<PostForEditor | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(
      "id, status, published_at, title, excerpt, body, category_id, byline, cover_media_id, created_by, updated_at, deleted_at, review_note, review_note_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    publishedAt: data.published_at,
    title: data.title,
    excerpt: data.excerpt,
    body: data.body,
    categoryId: data.category_id,
    byline: data.byline,
    coverMediaId: data.cover_media_id,
    createdBy: data.created_by,
    updatedAt: data.updated_at,
    inTrash: data.deleted_at !== null,
    reviewNote: data.review_note ? { text: data.review_note, at: data.review_note_at } : null,
  };
}

export type CoverInfo = {
  mediaId: string;
  altText: string | null;
  thumbnailUrl: string | null;
  issues: string[];
};

/** The cover with its preview and what it still needs, or null without cover. */
export async function getCover(mediaId: string | null): Promise<CoverInfo | null> {
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

export type Option = { id: string; name: string };

/** Story categories (created in Categorías y lugares). */
export async function listPostCategories(): Promise<Option[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("scope", "post")
    .is("deleted_at", null)
    .order("position")
    .order("name");
  if (error) throw error;
  return data;
}
