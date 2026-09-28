import "server-only";

import { supabasePrivateStorage } from "@/lib/storage/supabase";
import { createClient } from "@/lib/supabase/server";

import {
  CONSENT_PAGE_SIZE,
  type Channel,
  type ConsentFilters,
  type MinorOpinion,
  type SignerType,
  escapeLike,
} from "./schema";

export type ConsentSummary = {
  id: string;
  subjectName: string;
  isMinor: boolean;
  minorOpinion: MinorOpinion | null;
  signerType: SignerType;
  scopeDescription: string;
  grantedOn: string;
  validUntil: string | null;
  revokedAt: string | null;
  photoCount: number;
};

export type ConsentDetail = ConsentSummary & {
  signerName: string | null;
  channel: Channel;
  formVersion: string;
  revocationNote: string | null;
  createdAt: string;
};

const SUMMARY_COLUMNS =
  "id, subject_name, is_minor, minor_opinion, signer_type, scope_description, granted_on, valid_until, revoked_at, media_consents(count)";

type SummaryRow = {
  id: string;
  subject_name: string;
  is_minor: boolean;
  minor_opinion: string | null;
  signer_type: string;
  scope_description: string;
  granted_on: string;
  valid_until: string | null;
  revoked_at: string | null;
  media_consents: { count: number }[];
};

function toSummary(row: SummaryRow): ConsentSummary {
  return {
    id: row.id,
    subjectName: row.subject_name,
    isMinor: row.is_minor,
    minorOpinion: row.minor_opinion as MinorOpinion | null,
    signerType: row.signer_type as SignerType,
    scopeDescription: row.scope_description,
    grantedOn: row.granted_on,
    validUntil: row.valid_until,
    revokedAt: row.revoked_at,
    photoCount: row.media_consents[0]?.count ?? 0,
  };
}

/**
 * Authorizations not in the trash, newest signature first, read through RLS
 * (consent.manage + MFA). Call after authorizePage('consent.manage').
 */
export async function listConsents(
  filters: ConsentFilters,
): Promise<{ items: ConsentSummary[]; total: number; pageCount: number }> {
  const supabase = await createClient();
  let query = supabase
    .from("consent_records")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .is("deleted_at", null);

  if (filters.q) query = query.ilike("subject_name", `%${escapeLike(filters.q)}%`);
  if (filters.minors) query = query.eq("is_minor", true);
  if (filters.status === "active") query = query.is("revoked_at", null);
  if (filters.status === "revoked") query = query.not("revoked_at", "is", null);

  const offset = (filters.page - 1) * CONSENT_PAGE_SIZE;
  const { data, error, count } = await query
    .order("granted_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + CONSENT_PAGE_SIZE - 1);
  if (error && error.code !== "PGRST103") throw error;

  const total = count ?? 0;
  return {
    items: (error ? [] : (data as SummaryRow[])).map(toSummary),
    total,
    pageCount: Math.max(1, Math.ceil(total / CONSENT_PAGE_SIZE)),
  };
}

/** One authorization, or null when it does not exist or RLS hides it. */
export async function getConsent(id: string): Promise<ConsentDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consent_records")
    .select(`${SUMMARY_COLUMNS}, signer_name, channel, form_version, revocation_note, created_at`)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;

  const row = data as SummaryRow & {
    signer_name: string | null;
    channel: string;
    form_version: string;
    revocation_note: string | null;
    created_at: string;
  };
  return {
    ...toSummary(row),
    signerName: row.signer_name,
    channel: row.channel as Channel,
    formVersion: row.form_version,
    revocationNote: row.revocation_note,
    createdAt: row.created_at,
  };
}

const DOCUMENT_URL_SECONDS = 5 * 60;

/**
 * A 5-minute URL to the photo of the signed form. The path is read through
 * RLS (consent.manage + MFA): without it there is nothing to sign.
 */
export async function getConsentDocumentUrl(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consent_records")
    .select("document_path")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const urls = await supabasePrivateStorage().signedUrls(
    "consent-documents",
    [data.document_path],
    DOCUMENT_URL_SECONDS,
  );
  return urls.get(data.document_path) ?? null;
}
