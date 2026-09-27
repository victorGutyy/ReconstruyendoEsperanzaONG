// Private file storage behind our own interface (docs/04 §6): the modules never
// call the provider directly, so it can be replaced without touching them.

/** Private buckets (docs/06 §11). None of them has API policies. */
export type PrivateBucket = "media-incoming" | "media-private" | "consent-documents";

export type SignedUpload = {
  /** Absolute URL the browser uploads the file to (PUT). */
  signedUrl: string;
  path: string;
};

export interface PrivateStorage {
  /** One-file upload URL for exactly this path; the file cannot be overwritten. */
  createUploadUrl(bucket: PrivateBucket, path: string): Promise<SignedUpload>;
  /** null when the file does not exist. */
  download(bucket: PrivateBucket, path: string): Promise<Buffer | null>;
  upload(bucket: PrivateBucket, path: string, data: Buffer, contentType: string): Promise<void>;
  remove(bucket: PrivateBucket, paths: string[]): Promise<void>;
  /** Temporary read URLs, keyed by path (paths without a URL are skipped). */
  signedUrls(
    bucket: PrivateBucket,
    paths: string[],
    expiresInSeconds: number,
  ): Promise<Map<string, string>>;
}
