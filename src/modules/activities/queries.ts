import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { RichTextDoc } from "@/lib/rich-text/schema";
import { getPublishIssues } from "@/modules/media";

export type ActivityStatus = "draft" | "review" | "published" | "archived";

export type ActivitySummary = {
  id: string;
  title: string;
  status: ActivityStatus;
  publishedAt: string | null;
  startsAt: string;
  updatedAt: string;
  isMine: boolean;
};

const SUMMARY_COLUMNS = "id, title, status, published_at, starts_at, updated_at, created_by";

type SummaryRow = {
  id: string;
  title: string;
  status: ActivityStatus;
  published_at: string | null;
  starts_at: string;
  updated_at: string;
  created_by: string | null;
};

const toSummary = (userId: string) => (row: SummaryRow) => ({
  id: row.id,
  title: row.title,
  status: row.status,
  publishedAt: row.published_at,
  startsAt: row.starts_at,
  updatedAt: row.updated_at,
  isMine: row.created_by === userId,
});

/** The person's drafts and the latest activities (the full list and filters come in 7.4). */
export async function listActivitiesForPanel(userId: string) {
  const supabase = await createClient();
  const [mine, recent] = await Promise.all([
    supabase
      .from("activities")
      .select(SUMMARY_COLUMNS)
      .eq("created_by", userId)
      .in("status", ["draft", "review"])
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("activities")
      .select(SUMMARY_COLUMNS)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);
  if (mine.error) throw mine.error;
  if (recent.error) throw recent.error;
  return {
    mine: (mine.data as SummaryRow[]).map(toSummary(userId)),
    recent: (recent.data as SummaryRow[]).map(toSummary(userId)),
  };
}

export type ActivityPhoto = {
  linkId: string;
  mediaId: string;
  position: number;
  altText: string | null;
  processingStatus: string;
  people: string | null;
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
};

/** One activity with its photos in order, or null when RLS hides it. */
export async function getActivityForWizard(id: string): Promise<ActivityForWizard | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select(
      "id, slug, status, published_at, title, summary, body, starts_at, ends_at, place_id, category_id, cover_media_id, created_by, updated_at, deleted_at, activity_media(id, media_id, position, media(alt_text, processing_status, people_in_photo))",
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

/** Photos with what each still needs (codes from the database), in order. */
export async function getPhotosWithIssues(activity: ActivityForWizard) {
  const issues = await getPublishIssues(activity.photos.map((photo) => photo.mediaId));
  return activity.photos.map((photo, index) => ({
    ...photo,
    label: photo.altText ? `Foto ${index + 1} («${photo.altText}»)` : `Foto ${index + 1}`,
    issues: issues.get(photo.mediaId) ?? [],
  }));
}
