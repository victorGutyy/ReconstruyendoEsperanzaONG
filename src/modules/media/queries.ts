import "server-only";

import { supabasePrivateStorage } from "@/lib/storage/supabase";
import { createClient } from "@/lib/supabase/server";

import { LIBRARY_PAGE_SIZE, type LibraryFilters, type PeopleInPhoto } from "./library";
import { mediaPaths, type MediaStatus } from "./schema";

const IMAGE_URL_SECONDS = 60 * 60;
/** Max ids per call to public.media_publish_status (it refuses more). */
const STATUS_CHUNK = 500;
/** Upper bound when the "pending only" filter needs every photo (~1,800 fit in Storage). */
const PENDING_SCAN_LIMIT = 2000;

export type LibraryItem = {
  id: string;
  status: MediaStatus;
  createdAt: string;
  altText: string | null;
  isMine: boolean;
  inTrash: boolean;
  /** Temporary URL of the small version (ready photos only). */
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  issues: string[];
};

export type LibraryPage = { items: LibraryItem[]; total: number; pageCount: number };

type Row = {
  id: string;
  processing_status: string;
  created_at: string;
  alt_text: string | null;
  uploaded_by: string;
  deleted_at: string | null;
  width: number | null;
  height: number | null;
};

const COLUMNS =
  "id, processing_status, created_at, alt_text, uploaded_by, deleted_at, width, height";

/** Issue codes per photo, through the codes-only database function (step 6.4). */
async function publishStatus(ids: string[]): Promise<Map<string, string[]>> {
  const supabase = await createClient();
  const statuses = new Map<string, string[]>();
  for (let start = 0; start < ids.length; start += STATUS_CHUNK) {
    const { data, error } = await supabase.rpc("media_publish_status", {
      p_media_ids: ids.slice(start, start + STATUS_CHUNK),
    });
    if (error) throw error;
    for (const row of data) statuses.set(row.media_id, row.issues);
  }
  return statuses;
}

/**
 * One page of the library, newest first, read through RLS. Call after
 * authorizePage('media.upload'); `canSeeTrash` only for media.update.
 * Thumbnails are signed with the secret key (the bucket has no API policies).
 */
export async function listLibrary(
  filters: LibraryFilters,
  userId: string,
  canSeeTrash: boolean,
): Promise<LibraryPage> {
  const supabase = await createClient();
  const inTrash = filters.trash && canSeeTrash;

  let query = supabase.from("media").select(COLUMNS, { count: "exact" });
  query = inTrash ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
  if (filters.mine) query = query.eq("uploaded_by", userId);
  query = query.order("created_at", { ascending: false }).order("id");

  let rows: Row[];
  let statuses: Map<string, string[]>;
  let total: number;
  const offset = (filters.page - 1) * LIBRARY_PAGE_SIZE;

  if (filters.pending) {
    // Pending is computed per photo in the database: scan, keep those with issues
    const { data, error } = await query.limit(PENDING_SCAN_LIMIT);
    if (error) throw error;
    statuses = await publishStatus(data.map((row) => row.id));
    const pending = data.filter((row) => (statuses.get(row.id) ?? []).length > 0);
    total = pending.length;
    rows = pending.slice(offset, offset + LIBRARY_PAGE_SIZE);
  } else {
    const { data, error, count } = await query.range(offset, offset + LIBRARY_PAGE_SIZE - 1);
    if (error && error.code !== "PGRST103") throw error;
    rows = error ? [] : data;
    total = count ?? 0;
    statuses = await publishStatus(rows.map((row) => row.id));
  }

  const urls = await supabasePrivateStorage().signedUrls(
    "media-private",
    rows
      .filter((row) => row.processing_status === "ready")
      .map((row) => mediaPaths.variant(row.id, "sm")),
    IMAGE_URL_SECONDS,
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      status: row.processing_status as MediaStatus,
      createdAt: row.created_at,
      altText: row.alt_text,
      isMine: row.uploaded_by === userId,
      inTrash: row.deleted_at !== null,
      thumbnailUrl: urls.get(mediaPaths.variant(row.id, "sm")) ?? null,
      width: row.width,
      height: row.height,
      issues: statuses.get(row.id) ?? [],
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE)),
  };
}

export type MediaDetail = {
  id: string;
  status: MediaStatus;
  createdAt: string;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  people: PeopleInPhoto | null;
  inTrash: boolean;
  isMine: boolean;
  /** Name when RLS lets this person read it (own profile, or users.manage). */
  uploaderName: string | null;
  imageUrl: string | null;
  width: number | null;
  height: number | null;
  issues: string[];
};

/** One photo for its page, or null when it does not exist or RLS hides it. */
export async function getMediaDetail(id: string, userId: string): Promise<MediaDetail | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("media")
    .select(
      "id, processing_status, created_at, alt_text, caption, credit, people_in_photo, deleted_at, uploaded_by, width, height",
    )
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;

  const [statuses, uploader, urls] = await Promise.all([
    publishStatus([row.id]),
    supabase.from("profiles").select("full_name").eq("id", row.uploaded_by).maybeSingle(),
    row.processing_status === "ready"
      ? supabasePrivateStorage().signedUrls(
          "media-private",
          [mediaPaths.variant(row.id, "md")],
          IMAGE_URL_SECONDS,
        )
      : Promise.resolve(new Map<string, string>()),
  ]);

  return {
    id: row.id,
    status: row.processing_status as MediaStatus,
    createdAt: row.created_at,
    altText: row.alt_text,
    caption: row.caption,
    credit: row.credit,
    people: row.people_in_photo as PeopleInPhoto | null,
    inTrash: row.deleted_at !== null,
    isMine: row.uploaded_by === userId,
    uploaderName: uploader.data?.full_name ?? null,
    imageUrl: urls.get(mediaPaths.variant(row.id, "md")) ?? null,
    width: row.width,
    height: row.height,
    issues: statuses.get(row.id) ?? [],
  };
}

export type MediaCard = {
  id: string;
  altText: string | null;
  thumbnailUrl: string | null;
  inTrash: boolean;
};

/**
 * Small cards for photos listed elsewhere (e.g. the photos an authorization
 * covers), read through RLS. Call after the page checked its permission.
 */
export async function getMediaCards(ids: string[]): Promise<MediaCard[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .select("id, alt_text, processing_status, deleted_at")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const urls = await supabasePrivateStorage().signedUrls(
    "media-private",
    data
      .filter((row) => row.processing_status === "ready")
      .map((row) => mediaPaths.variant(row.id, "sm")),
    IMAGE_URL_SECONDS,
  );

  return data.map((row) => ({
    id: row.id,
    altText: row.alt_text,
    thumbnailUrl: urls.get(mediaPaths.variant(row.id, "sm")) ?? null,
    inTrash: row.deleted_at !== null,
  }));
}
