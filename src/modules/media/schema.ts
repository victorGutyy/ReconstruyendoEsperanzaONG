import { z } from "zod";

// Photo uploads (step 6.3, docs/04 §5.3). Pure: unit-tested in schema.test.ts.

/** The browser always sends a JPEG it re-encoded; PNG/WebP are accepted too. */
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const requestUploadSchema = z.object({
  type: z.enum(UPLOAD_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export const mediaIdSchema = z.uuid();

/** Where each file lives. The media id is the only name ever used. */
export const mediaPaths = {
  incoming: (mediaId: string) => mediaId,
  folder: (mediaId: string) => mediaId,
  variant: (mediaId: string, size: string) => `${mediaId}/${size}.webp`,
};

export type MediaStatus = "processing" | "ready" | "failed";

export type UploadResult = { ok: true } | { ok: false; error: string };

export type RequestUploadResult =
  { ok: true; mediaId: string; signedUrl: string } | { ok: false; error: string };

const REJECTION_MESSAGES = {
  too_large: "La foto pesa más de 15 MB.",
  unsupported_type: "El archivo no es una foto JPEG, PNG o WebP.",
  too_many_pixels: "La foto es demasiado grande (más de 50 megapíxeles).",
  unreadable: "No pudimos leer la foto. Puede estar dañada.",
} as const;

export function rejectionMessage(reason: keyof typeof REJECTION_MESSAGES): string {
  return REJECTION_MESSAGES[reason];
}
