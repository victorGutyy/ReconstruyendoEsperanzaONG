import "server-only";

import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/utils/like";
import type { ContentStatus } from "@/modules/content";

import { type TestimonialFilters, TESTIMONIALS_PAGE_SIZE } from "./list";

/** Today in Colombia as YYYY-MM-DD (authorizations end on a date). */
const todayInBogota = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

/** The authorization stopped backing it: revoked, in the trash, or expired. */
const consentGone = (row: { consent_withdrawn: boolean; consent_valid_until: string | null }) =>
  row.consent_withdrawn ||
  (row.consent_valid_until !== null && row.consent_valid_until < todayInBogota());

/** PostgREST filter for the same rule. */
const consentGoneFilter = () =>
  `consent_withdrawn.eq.true,consent_valid_until.lt.${todayInBogota()}`;

export type TestimonialSummary = {
  id: string;
  quote: string;
  authorName: string;
  status: ContentStatus;
  publishedAt: string | null;
  isMine: boolean;
  /** Its authorization was revoked or expired: hidden from the site. */
  consentGone: boolean;
};

const COLUMNS =
  "id, quote, author_display_name, status, published_at, created_by, consent_withdrawn, consent_valid_until";

/** One page of the panel list, newest changes first (RLS: consent.manage). */
export async function listTestimonials(
  filters: TestimonialFilters,
  userId: string,
): Promise<{ items: TestimonialSummary[]; total: number; pageCount: number }> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("testimonials")
    .select(COLUMNS, { count: "exact" })
    .is("deleted_at", null);
  if (filters.status === "scheduled") {
    query = query.eq("status", "published").gt("published_at", now);
  } else if (filters.status === "published") {
    query = query.eq("status", "published").lte("published_at", now);
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.withdrawn) query = query.eq("status", "published").or(consentGoneFilter());
  if (filters.q) {
    const text = escapeLike(filters.q).replace(/[,()]/g, " ");
    query = query.or(`author_display_name.ilike.%${text}%,quote.ilike.%${text}%`);
  }
  if (filters.mine) query = query.eq("created_by", userId);

  const offset = (filters.page - 1) * TESTIMONIALS_PAGE_SIZE;
  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .order("id")
    .range(offset, offset + TESTIMONIALS_PAGE_SIZE - 1);
  if (error && error.code !== "PGRST103") throw error;

  const total = count ?? 0;
  return {
    items: (error ? [] : data).map((row) => ({
      id: row.id,
      quote: row.quote,
      authorName: row.author_display_name,
      status: row.status,
      publishedAt: row.published_at,
      isMine: row.created_by === userId,
      consentGone: consentGone(row),
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / TESTIMONIALS_PAGE_SIZE)),
  };
}

/** Counts for the dashboard and the "Por revisar" tab. */
export async function countTestimonials(userId: string) {
  const supabase = await createClient();
  const live = () =>
    supabase
      .from("testimonials")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null);
  const results = await Promise.all([
    live().eq("status", "review"),
    live().eq("status", "draft").eq("created_by", userId),
    live().eq("status", "published").or(consentGoneFilter()),
  ]);
  const [toReview, myDrafts, withdrawn] = results.map(({ count, error }) => {
    if (error) throw error;
    return count ?? 0;
  });
  return { toReview: toReview!, myDrafts: myDrafts!, withdrawn: withdrawn! };
}

export type TestimonialForEditor = {
  id: string;
  status: ContentStatus;
  publishedAt: string | null;
  quote: string;
  authorName: string;
  authorContext: string | null;
  consentId: string;
  consentGone: boolean;
  activityId: string | null;
  projectId: string | null;
  coverMediaId: string | null;
  createdBy: string | null;
  updatedAt: string;
  inTrash: boolean;
  reviewNote: { text: string; at: string | null } | null;
};

/** One testimonial, or null when RLS hides it. */
export async function getTestimonial(id: string): Promise<TestimonialForEditor | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("testimonials")
    .select(
      "id, status, published_at, quote, author_display_name, author_context, consent_record_id, consent_withdrawn, consent_valid_until, activity_id, project_id, cover_media_id, created_by, updated_at, deleted_at, review_note, review_note_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    publishedAt: data.published_at,
    quote: data.quote,
    authorName: data.author_display_name,
    authorContext: data.author_context,
    consentId: data.consent_record_id,
    consentGone: consentGone(data),
    activityId: data.activity_id,
    projectId: data.project_id,
    coverMediaId: data.cover_media_id,
    createdBy: data.created_by,
    updatedAt: data.updated_at,
    inTrash: data.deleted_at !== null,
    reviewNote: data.review_note ? { text: data.review_note, at: data.review_note_at } : null,
  };
}

/** Testimonials that rely on an authorization (to sync their photos when it changes). */
export async function listTestimonialIdsForConsent(consentId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("testimonials")
    .select("id")
    .eq("consent_record_id", consentId);
  if (error) throw error;
  return data.map((row) => row.id);
}
