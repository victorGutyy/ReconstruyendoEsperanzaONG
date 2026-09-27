import "server-only";

import { supabasePrivateStorage } from "@/lib/storage/supabase";
import { createClient } from "@/lib/supabase/server";

import { mediaPaths, type MediaStatus } from "./schema";

export type RecentUpload = {
  id: string;
  status: MediaStatus;
  createdAt: string;
  /** Temporary URL of the small version (ready photos only). */
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
};

const THUMBNAIL_URL_SECONDS = 60 * 60;

/**
 * The signed-in person's latest uploads (not in the trash), read through RLS.
 * Call after authorizePage('media.upload'): thumbnails are signed with the
 * secret key because the private bucket has no API policies.
 */
export async function listMyRecentUploads(userId: string, limit = 24): Promise<RecentUpload[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .select("id, processing_status, created_at, width, height")
    .eq("uploaded_by", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const ready = data.filter((row) => row.processing_status === "ready");
  const urls = await supabasePrivateStorage().signedUrls(
    "media-private",
    ready.map((row) => mediaPaths.variant(row.id, "sm")),
    THUMBNAIL_URL_SECONDS,
  );

  return data.map((row) => ({
    id: row.id,
    status: row.processing_status as MediaStatus,
    createdAt: row.created_at,
    thumbnailUrl: urls.get(mediaPaths.variant(row.id, "sm")) ?? null,
    width: row.width,
    height: row.height,
  }));
}
