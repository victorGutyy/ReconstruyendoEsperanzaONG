import "server-only";

import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/utils/like";
import type { ContentStatus } from "@/modules/content";
import { getMediaCards, getPublishIssues } from "@/modules/media";

import { type GalleryFilters, GALLERIES_PAGE_SIZE } from "./list";

export type GallerySummary = {
  id: string;
  title: string;
  status: ContentStatus;
  publishedAt: string | null;
  updatedAt: string;
  isMine: boolean;
  photoCount: number;
  /** Published with photos taken off the site (step 7.5b). */
  hasWithdrawnPhotos: boolean;
};

/** One page of the panel list, newest changes first. */
export async function listGalleries(
  filters: GalleryFilters,
  userId: string,
): Promise<{ items: GallerySummary[]; total: number; pageCount: number }> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("galleries")
    .select("id, title, status, published_at, updated_at, created_by, gallery_items(media_id)", {
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
  if (filters.q) query = query.ilike("title", `%${escapeLike(filters.q)}%`);
  if (filters.mine) query = query.eq("created_by", userId);

  const offset = (filters.page - 1) * GALLERIES_PAGE_SIZE;
  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .order("id")
    .range(offset, offset + GALLERIES_PAGE_SIZE - 1);
  if (error && error.code !== "PGRST103") throw error;

  const rows = error ? [] : data;
  const published = rows.filter((row) => row.status === "published");
  const issues = await getPublishIssues([
    ...new Set(published.flatMap((row) => row.gallery_items.map((item) => item.media_id))),
  ]);
  const total = count ?? 0;
  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      isMine: row.created_by === userId,
      photoCount: row.gallery_items.length,
      hasWithdrawnPhotos:
        row.status === "published" &&
        row.gallery_items.some((item) => (issues.get(item.media_id) ?? []).length > 0),
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / GALLERIES_PAGE_SIZE)),
  };
}

/** Counts for the dashboard and the "Por revisar" tab. */
export async function countGalleries(userId: string) {
  const supabase = await createClient();
  const live = () =>
    supabase.from("galleries").select("id", { count: "exact", head: true }).is("deleted_at", null);
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

export type GalleryPhoto = {
  mediaId: string;
  position: number;
  caption: string | null;
  altText: string | null;
  label: string;
  processing: boolean;
  isPublic: boolean;
  thumbnailUrl: string | null;
  issues: string[];
};

export type GalleryForEditor = {
  id: string;
  status: ContentStatus;
  publishedAt: string | null;
  title: string;
  description: string | null;
  activityId: string | null;
  projectId: string | null;
  coverMediaId: string | null;
  createdBy: string | null;
  updatedAt: string;
  inTrash: boolean;
  reviewNote: { text: string; at: string | null } | null;
  photos: GalleryPhoto[];
};

/** One gallery with its photos in order, or null when RLS hides it. */
export async function getGallery(id: string): Promise<GalleryForEditor | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("galleries")
    .select(
      "id, status, published_at, title, description, activity_id, project_id, cover_media_id, created_by, updated_at, deleted_at, review_note, review_note_at, gallery_items(media_id, position, caption, media(alt_text, processing_status, public_key))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const items = [...data.gallery_items].sort((a, b) => a.position - b.position);
  const ids = items.map((item) => item.media_id);
  const [cards, issues] = await Promise.all([getMediaCards(ids), getPublishIssues(ids)]);
  const thumbnails = new Map(cards.map((card) => [card.id, card.thumbnailUrl]));

  return {
    id: data.id,
    status: data.status,
    publishedAt: data.published_at,
    title: data.title,
    description: data.description,
    activityId: data.activity_id,
    projectId: data.project_id,
    coverMediaId: data.cover_media_id,
    createdBy: data.created_by,
    updatedAt: data.updated_at,
    inTrash: data.deleted_at !== null,
    reviewNote: data.review_note ? { text: data.review_note, at: data.review_note_at } : null,
    photos: items.map((item, index) => {
      const altText = item.media?.alt_text ?? null;
      return {
        mediaId: item.media_id,
        position: item.position,
        caption: item.caption,
        altText,
        label: altText ? `Foto ${index + 1} («${altText}»)` : `Foto ${index + 1}`,
        processing: item.media?.processing_status !== "ready",
        isPublic: Boolean(item.media?.public_key),
        thumbnailUrl: thumbnails.get(item.media_id) ?? null,
        issues: issues.get(item.media_id) ?? [],
      };
    }),
  };
}

export type OwnerOptions = {
  activities: { id: string; name: string }[];
  projects: { id: string; name: string }[];
};

/**
 * Activities and projects a gallery can belong to: not in the trash and not
 * archived (the current owner stays listed so it is never dropped silently).
 */
export async function listOwnerOptions(keep: {
  activityId: string | null;
  projectId: string | null;
}): Promise<OwnerOptions> {
  const supabase = await createClient();
  const [activities, projects] = await Promise.all([
    supabase
      .from("activities")
      .select("id, title, status")
      .is("deleted_at", null)
      .order("starts_at", { ascending: false })
      .limit(200),
    supabase.from("projects").select("id, title, status").is("deleted_at", null).order("title"),
  ]);
  if (activities.error) throw activities.error;
  if (projects.error) throw projects.error;
  const usable = (keepId: string | null) => (row: { id: string; status: string }) =>
    row.status !== "archived" || row.id === keepId;
  return {
    activities: activities.data
      .filter(usable(keep.activityId))
      .map((row) => ({ id: row.id, name: row.title })),
    projects: projects.data
      .filter(usable(keep.projectId))
      .map((row) => ({ id: row.id, name: row.title })),
  };
}
