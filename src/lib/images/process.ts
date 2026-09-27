// Re-encodes an uploaded image with sharp (docs/05 §6.1, docs/04 §5.3):
// new files are generated from the pixels only, so EXIF, GPS and anything
// hidden in the original are gone. Server-side only (sharp is a Node addon);
// imported from Server Actions.
import sharp, { type Metadata } from "sharp";

import { detectImageType } from "./signature";

/** Widths of the stored versions: thumbnail, detail, full screen. */
export const MEDIA_WIDTHS = { sm: 480, md: 1080, lg: 1920 } as const;
export type MediaSize = keyof typeof MEDIA_WIDTHS;

/** 15 MB before reduction (docs/05 §6.1). */
export const MAX_INPUT_BYTES = 15 * 1024 * 1024;
/** Guards against decompression bombs: ~50 megapixels (8660 × 5773). */
export const MAX_INPUT_PIXELS = 50_000_000;

const WEBP_QUALITY = 80;

export type RejectionReason = "too_large" | "unsupported_type" | "too_many_pixels" | "unreadable";

export class ImageRejectedError extends Error {
  constructor(readonly reason: RejectionReason) {
    super(`Image rejected: ${reason}`);
    this.name = "ImageRejectedError";
  }
}

export type ProcessedVariant<S extends string = string> = {
  size: S;
  data: Buffer;
  width: number;
  height: number;
  bytes: number;
};

export type ProcessOptions<S extends string> = {
  widths: Record<S, number>;
  maxPixels?: number;
};

/**
 * Validates the real type and size, applies the EXIF orientation, then writes
 * one WebP per requested width (never enlarging) without any metadata.
 */
export async function processImage<S extends string = MediaSize>(
  input: Buffer,
  options?: ProcessOptions<S>,
): Promise<ProcessedVariant<S>[]> {
  const widths = (options?.widths ?? MEDIA_WIDTHS) as Record<S, number>;
  const maxPixels = options?.maxPixels ?? MAX_INPUT_PIXELS;

  if (input.byteLength > MAX_INPUT_BYTES) throw new ImageRejectedError("too_large");
  if (!detectImageType(input)) throw new ImageRejectedError("unsupported_type");

  // Read the header first: the pixel limit is checked before decoding
  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: false }).metadata();
  } catch {
    throw new ImageRejectedError("unreadable");
  }
  if (!metadata.width || !metadata.height) throw new ImageRejectedError("unreadable");
  if (metadata.width * metadata.height > maxPixels) throw new ImageRejectedError("too_many_pixels");

  const base = sharp(input, { limitInputPixels: maxPixels, failOn: "error" }).rotate();

  try {
    return await Promise.all(
      (Object.entries(widths) as [S, number][]).map(async ([size, width]) => {
        const { data, info } = await base
          .clone()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer({ resolveWithObject: true });
        return { size, data, width: info.width, height: info.height, bytes: info.size };
      }),
    );
  } catch {
    throw new ImageRejectedError("unreadable");
  }
}
