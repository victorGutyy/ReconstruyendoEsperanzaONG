import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { RichTextDoc } from "@/lib/rich-text/schema";
import type { ContentStatus } from "@/modules/content";

import { hasPendingText, PAGE_KEYS, type PageKey } from "./schema";

export type PageSummary = {
  id: string;
  key: PageKey;
  title: string;
  status: ContentStatus;
  publishedAt: string | null;
  version: string | null;
  pendingText: boolean;
};

/** The four pages in a fixed order. */
export async function listPages(): Promise<PageSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pages")
    .select("id, key, title, status, published_at, version, body_text");
  if (error) throw error;
  return data
    .map((row) => ({
      id: row.id,
      key: row.key as PageKey,
      title: row.title,
      status: row.status,
      publishedAt: row.published_at,
      version: row.version,
      pendingText: hasPendingText(row.title, row.body_text),
    }))
    .sort((a, b) => PAGE_KEYS.indexOf(a.key) - PAGE_KEYS.indexOf(b.key));
}

/** How many pages still say [PENDIENTE (for the dashboard). */
export async function countPendingPages(): Promise<number> {
  return (await listPages()).filter((page) => page.pendingText).length;
}

export type PageForEditor = {
  id: string;
  key: PageKey;
  status: ContentStatus;
  publishedAt: string | null;
  title: string;
  body: RichTextDoc | null;
  bodyText: string | null;
  version: string | null;
  updatedAt: string;
  reviewNote: { text: string; at: string | null } | null;
};

export async function getPage(id: string): Promise<PageForEditor | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pages")
    .select(
      "id, key, status, published_at, title, body, body_text, version, updated_at, review_note, review_note_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    key: data.key as PageKey,
    status: data.status,
    publishedAt: data.published_at,
    title: data.title,
    body: data.body as RichTextDoc | null,
    bodyText: data.body_text,
    version: data.version,
    updatedAt: data.updated_at,
    reviewNote: data.review_note ? { text: data.review_note, at: data.review_note_at } : null,
  };
}

export type PageVersion = { version: string; publishedAt: string };

/** The published versions of a legal page, newest first. */
export async function listPageVersions(pageId: string): Promise<PageVersion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("page_versions")
    .select("version, published_at")
    .eq("page_id", pageId)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({ version: row.version, publishedAt: row.published_at }));
}
