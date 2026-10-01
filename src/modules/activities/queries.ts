import "server-only";

import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/utils/like";
import type { RichTextDoc } from "@/lib/rich-text/schema";
import { getPublishIssues } from "@/modules/media";

import { ACTIVITIES_PAGE_SIZE, type ActivityFilters } from "./list";

export type ActivityStatus = "draft" | "review" | "published" | "archived";

export type ActivitySummary = {
  id: string;
  title: string;
  status: ActivityStatus;
  publishedAt: string | null;
  startsAt: string;
  updatedAt: string;
  isMine: boolean;
  categoryName: string | null;
  placeName: string | null;
  /** Published, with photos taken off the site (step 7.5b). */
  hasWithdrawnPhotos: boolean;
};

const SUMMARY_COLUMNS =
  "id, title, status, published_at, starts_at, updated_at, created_by, category:categories(name), place:places(name)";

/**
 * One page of the panel list (step 7.4), newest changes first. "Scheduled"
 * and "published" are both stored as published: the date tells them apart.
 */
export async function listActivities(
  filters: ActivityFilters,
  userId: string,
): Promise<{ items: ActivitySummary[]; total: number; pageCount: number }> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("activities")
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
  if (filters.place) query = query.eq("place_id", filters.place);
  if (filters.q) query = query.ilike("title", `%${escapeLike(filters.q)}%`);
  if (filters.mine) query = query.eq("created_by", userId);
  if (filters.withdrawn) {
    const affected = [...(await findActivitiesWithWithdrawnPhotos())];
    if (affected.length === 0) return { items: [], total: 0, pageCount: 1 };
    query = query.in("id", affected);
  }

  const offset = (filters.page - 1) * ACTIVITIES_PAGE_SIZE;
  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .order("id")
    .range(offset, offset + ACTIVITIES_PAGE_SIZE - 1);
  // A page past the end answers PGRST103: show it empty
  if (error && error.code !== "PGRST103") throw error;

  const total = count ?? 0;
  const rows = error ? [] : data;
  const withdrawn = await findActivitiesWithWithdrawnPhotos(
    rows.filter((row) => row.status === "published").map((row) => row.id),
  );
  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      publishedAt: row.published_at,
      startsAt: row.starts_at,
      updatedAt: row.updated_at,
      isMine: row.created_by === userId,
      categoryName: row.category?.name ?? null,
      placeName: row.place?.name ?? null,
      hasWithdrawnPhotos: withdrawn.has(row.id),
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / ACTIVITIES_PAGE_SIZE)),
  };
}

/**
 * Published (or scheduled) activities that use photos which are no longer
 * publishable, e.g. after an authorization was revoked: those photos left the
 * site (step 7.5b). All of them, or only among `activityIds`.
 */
export async function findActivitiesWithWithdrawnPhotos(
  activityIds?: string[],
): Promise<Set<string>> {
  if (activityIds && activityIds.length === 0) return new Set();
  const supabase = await createClient();
  let query = supabase
    .from("activities")
    .select("id, cover_media_id, activity_media(media_id)")
    .eq("status", "published")
    .is("deleted_at", null);
  if (activityIds) query = query.in("id", activityIds);
  const { data, error } = await query;
  if (error) throw error;

  const photosOf = new Map(
    data.map((row) => [
      row.id,
      [row.cover_media_id, ...row.activity_media.map((link) => link.media_id)].filter(
        (id): id is string => id !== null,
      ),
    ]),
  );
  const issues = await getPublishIssues([...new Set([...photosOf.values()].flat())]);
  return new Set(
    [...photosOf]
      .filter(([, photos]) => photos.some((id) => (issues.get(id) ?? []).length > 0))
      .map(([id]) => id),
  );
}

/** Counts for the dashboard and the "Por revisar" tab. */
export async function countActivities(userId: string) {
  const supabase = await createClient();
  const live = () =>
    supabase.from("activities").select("id", { count: "exact", head: true }).is("deleted_at", null);

  const results = await Promise.all([
    live().eq("status", "review"),
    live().eq("status", "draft").eq("created_by", userId),
    live().eq("status", "review").eq("created_by", userId),
  ]);
  const [toReview, myDrafts, myInReview] = results.map(({ count, error }) => {
    if (error) throw error;
    return count ?? 0;
  });
  return { toReview: toReview!, myDrafts: myDrafts!, myInReview: myInReview! };
}

export type ActivityPhoto = {
  linkId: string;
  mediaId: string;
  position: number;
  altText: string | null;
  processingStatus: string;
  people: string | null;
  /** Copied to public storage (step 7.5): visible on the site. */
  isPublic: boolean;
};

export type ActivityForWizard = {
  id: string;
  slug: string;
  status: ActivityStatus;
  publishedAt: string | null;
  title: string;
  summary: string | null;
  body: RichTextDoc | null;
  startsAt: string;
  endsAt: string | null;
  placeId: string | null;
  categoryId: string | null;
  coverMediaId: string | null;
  createdBy: string | null;
  updatedAt: string;
  inTrash: boolean;
  photos: ActivityPhoto[];
  tagIds: string[];
  /** What an Editor asked to fix when returning or retiring it. */
  reviewNote: { text: string; at: string | null } | null;
};

/** One activity with its photos in order, or null when RLS hides it. */
export async function getActivityForWizard(id: string): Promise<ActivityForWizard | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select(
      "id, slug, status, published_at, title, summary, body, starts_at, ends_at, place_id, category_id, cover_media_id, created_by, updated_at, deleted_at, review_note, review_note_at, activity_tags(tag_id), activity_media(id, media_id, position, media(alt_text, processing_status, people_in_photo, public_key))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const photos = data.activity_media
    .map((link) => ({
      linkId: link.id,
      mediaId: link.media_id,
      position: link.position,
      altText: link.media?.alt_text ?? null,
      processingStatus: link.media?.processing_status ?? "failed",
      people: link.media?.people_in_photo ?? null,
      isPublic: Boolean(link.media?.public_key),
    }))
    .sort((a, b) => a.position - b.position);

  return {
    id: data.id,
    slug: data.slug,
    status: data.status,
    publishedAt: data.published_at,
    title: data.title,
    summary: data.summary,
    body: data.body as RichTextDoc | null,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    placeId: data.place_id,
    categoryId: data.category_id,
    coverMediaId: data.cover_media_id,
    createdBy: data.created_by,
    updatedAt: data.updated_at,
    inTrash: data.deleted_at !== null,
    photos,
    tagIds: data.activity_tags.map((link) => link.tag_id),
    reviewNote: data.review_note ? { text: data.review_note, at: data.review_note_at } : null,
  };
}

export type Option = { id: string; name: string };

/** Active places and activity categories for step 1 (read through RLS). */
export async function listBasicsOptions(): Promise<{ places: Option[]; categories: Option[] }> {
  const supabase = await createClient();
  const [places, categories] = await Promise.all([
    supabase
      .from("places")
      .select("id, name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("categories")
      .select("id, name")
      .eq("scope", "activity")
      .is("deleted_at", null)
      .order("position")
      .order("name"),
  ]);
  if (places.error) throw places.error;
  if (categories.error) throw categories.error;
  return { places: places.data, categories: categories.data };
}

/** Tags that can be chosen (created in Categorías y lugares). */
export async function listTags(): Promise<Option[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data;
}

/** Photos with what each still needs (codes from the database), in order. */
export async function getPhotosWithIssues(activity: ActivityForWizard) {
  const issues = await getPublishIssues(activity.photos.map((photo) => photo.mediaId));
  return activity.photos.map((photo, index) => ({
    ...photo,
    label: photo.altText ? `Foto ${index + 1} («${photo.altText}»)` : `Foto ${index + 1}`,
    issues: issues.get(photo.mediaId) ?? [],
  }));
}
