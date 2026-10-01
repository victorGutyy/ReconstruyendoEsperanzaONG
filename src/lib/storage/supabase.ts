import "server-only";

import { getPublicEnv } from "@/lib/env/public";
import { createAdminClient } from "@/lib/supabase/admin";

import type { PrivateBucket, PrivateStorage, PublicStorage, SignedUpload } from "./types";

/**
 * Supabase Storage with the secret key. The buckets have no API policies, so
 * this is the only way in: call it only AFTER the app checked the permission
 * and MFA (docs/05 §5).
 */
export function supabasePrivateStorage(): PrivateStorage {
  const storage = createAdminClient().storage;

  return {
    async createUploadUrl(bucket: PrivateBucket, path: string): Promise<SignedUpload> {
      const { data, error } = await storage.from(bucket).createSignedUploadUrl(path);
      if (error) throw error;
      return { signedUrl: data.signedUrl, path: data.path };
    },

    async download(bucket, path) {
      const { data, error } = await storage.from(bucket).download(path);
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    },

    async upload(bucket, path, data, contentType) {
      const { error } = await storage
        .from(bucket)
        .upload(path, data, { contentType, upsert: true, cacheControl: "3600" });
      if (error) throw error;
    },

    async remove(bucket, paths) {
      if (paths.length === 0) return;
      const { error } = await storage.from(bucket).remove(paths);
      if (error) throw error;
    },

    async signedUrls(bucket, paths, expiresInSeconds) {
      const urls = new Map<string, string>();
      if (paths.length === 0) return urls;
      const { data, error } = await storage.from(bucket).createSignedUrls(paths, expiresInSeconds);
      if (error) throw error;
      for (const item of data) {
        if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
      }
      return urls;
    },
  };
}

const PUBLIC_BUCKET = "media-public";
/** One year: keys change whenever a photo becomes public again. */
const PUBLIC_CACHE_SECONDS = String(60 * 60 * 24 * 365);

/** URL of a public file (no secret needed; also used to render public pages). */
export function supabasePublicUrl(key: string): string {
  return `${getPublicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${key}`;
}

/** The public bucket, written with the secret key (no API policies). */
export function supabasePublicStorage(): PublicStorage {
  const bucket = createAdminClient().storage.from(PUBLIC_BUCKET);

  return {
    async put(key, data, contentType) {
      const { error } = await bucket.upload(key, data, {
        contentType,
        upsert: false,
        cacheControl: PUBLIC_CACHE_SECONDS,
      });
      if (error) throw error;
    },

    async remove(keys) {
      if (keys.length === 0) return;
      const { error } = await bucket.remove(keys);
      if (error) throw error;
    },

    publicUrl: supabasePublicUrl,
  };
}
