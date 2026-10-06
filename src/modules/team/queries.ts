import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ContentStatus } from "@/modules/content";

/** Today in Colombia as YYYY-MM-DD (authorizations end on a date). */
const todayInBogota = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

/** The authorization is missing, revoked, in the trash or expired. */
const consentGone = (row: { consent_withdrawn: boolean; consent_valid_until: string | null }) =>
  row.consent_withdrawn ||
  (row.consent_valid_until !== null && row.consent_valid_until < todayInBogota());

export type TeamSummary = {
  id: string;
  fullName: string;
  roleTitle: string;
  status: ContentStatus;
  publishedAt: string | null;
  position: number;
  consentGone: boolean;
};

/** The whole team in its order (it is short: no pages). RLS: consent.manage. */
export async function listTeam(): Promise<TeamSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_members")
    .select(
      "id, full_name, role_title, status, published_at, position, consent_withdrawn, consent_valid_until",
    )
    .is("deleted_at", null)
    .order("position")
    .order("full_name");
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    roleTitle: row.role_title,
    status: row.status,
    publishedAt: row.published_at,
    position: row.position,
    consentGone: consentGone(row),
  }));
}

/** Counts for the dashboard. */
export async function countTeam(userId: string) {
  const supabase = await createClient();
  const live = () =>
    supabase
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null);
  const results = await Promise.all([
    live().eq("status", "review"),
    live().eq("status", "draft").eq("created_by", userId),
    live()
      .eq("status", "published")
      .or(`consent_withdrawn.eq.true,consent_valid_until.lt.${todayInBogota()}`),
  ]);
  const [toReview, myDrafts, withdrawn] = results.map(({ count, error }) => {
    if (error) throw error;
    return count ?? 0;
  });
  return { toReview: toReview!, myDrafts: myDrafts!, withdrawn: withdrawn! };
}

export type TeamMemberForEditor = {
  id: string;
  status: ContentStatus;
  publishedAt: string | null;
  fullName: string;
  roleTitle: string;
  bio: string | null;
  consentId: string | null;
  consentGone: boolean;
  coverMediaId: string | null;
  createdBy: string | null;
  updatedAt: string;
  inTrash: boolean;
  reviewNote: { text: string; at: string | null } | null;
};

/** One profile, or null when RLS hides it. */
export async function getTeamMember(id: string): Promise<TeamMemberForEditor | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select(
      "id, status, published_at, full_name, role_title, bio, consent_record_id, consent_withdrawn, consent_valid_until, cover_media_id, created_by, updated_at, deleted_at, review_note, review_note_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    publishedAt: data.published_at,
    fullName: data.full_name,
    roleTitle: data.role_title,
    bio: data.bio,
    consentId: data.consent_record_id,
    consentGone: consentGone(data),
    coverMediaId: data.cover_media_id,
    createdBy: data.created_by,
    updatedAt: data.updated_at,
    inTrash: data.deleted_at !== null,
    reviewNote: data.review_note ? { text: data.review_note, at: data.review_note_at } : null,
  };
}
