import "server-only";

import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/utils/like";
import type { ContentStatus } from "@/modules/content";
import { getPublishIssues } from "@/modules/media";

import { type VideoFilters, VIDEOS_PAGE_SIZE } from "./list";
import type { Provider } from "./parse";

export type VideoSummary = {
  id: string;
  title: string;
  status: ContentStatus;
  publishedAt: string | null;
  updatedAt: string;
  isMine: boolean;
  provider: Provider;
  /** Published with a cover that is no longer publishable (step 7.5b). */
  coverWithdrawn: boolean;
};

/** One page of the panel list, newest changes first. */
export async function listVideos(
  filters: VideoFilters,
  userId: string,
): Promise<{ items: VideoSummary[]; total: number; pageCount: number }> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("videos")
    .select("id, title, status, published_at, updated_at, created_by, cover_media_id, provider", {
      count: "exact",
    })
    .is("deleted_at", null);
  if (filters.status === "scheduled") {
    query = query.eq("status", "published").gt("published_at", now);
  } else if (filters.status === "published") {
    query = query.eq("status", "published").lte("published_at", now);
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.provider) query = query.eq("provider", filters.provider);
  if (filters.q) query = query.ilike("title", `%${escapeLike(filters.q)}%`);
  if (filters.mine) query = query.eq("created_by", userId);

  const offset = (filters.page - 1) * VIDEOS_PAGE_SIZE;
  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .order("id")
    .range(offset, offset + VIDEOS_PAGE_SIZE - 1);
  if (error && error.code !== "PGRST103") throw error;

  const rows = error ? [] : data;
  const issues = await getPublishIssues(
    rows
      .filter((row) => row.status === "published" && row.cover_media_id)
      .map((row) => row.cover_media_id!),
  );
  const total = count ?? 0;
  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      isMine: row.created_by === userId,
      provider: row.provider as Provider,
      coverWithdrawn:
        row.status === "published" &&
        row.cover_media_id !== null &&
        (issues.get(row.cover_media_id) ?? []).length > 0,
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / VIDEOS_PAGE_SIZE)),
  };
}

/** Counts for the dashboard and the "Por revisar" tab. */
export async function countVideos(userId: string) {
  const supabase = await createClient();
  const live = () =>
    supabase.from("videos").select("id", { count: "exact", head: true }).is("deleted_at", null);
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

export type VideoForEditor = {
  id: string;
  status: ContentStatus;
  publishedAt: string | null;
  title: string;
  description: string | null;
  provider: Provider;
  providerVideoId: string;
  activityId: string | null;
  projectId: string | null;
  coverMediaId: string | null;
  createdBy: string | null;
  updatedAt: string;
  inTrash: boolean;
  reviewNote: { text: string; at: string | null } | null;
};

/** One video, or null when RLS hides it. */
export async function getVideo(id: string): Promise<VideoForEditor | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("videos")
    .select(
      "id, status, published_at, title, description, provider, provider_video_id, activity_id, project_id, cover_media_id, created_by, updated_at, deleted_at, review_note, review_note_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    publishedAt: data.published_at,
    title: data.title,
    description: data.description,
    provider: data.provider as Provider,
    providerVideoId: data.provider_video_id,
    activityId: data.activity_id,
    projectId: data.project_id,
    coverMediaId: data.cover_media_id,
    createdBy: data.created_by,
    updatedAt: data.updated_at,
    inTrash: data.deleted_at !== null,
    reviewNote: data.review_note ? { text: data.review_note, at: data.review_note_at } : null,
  };
}
