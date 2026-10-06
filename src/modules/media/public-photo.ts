import "server-only";

import { MEDIA_WIDTHS, type MediaSize } from "@/lib/images/process";
import { supabasePublicUrl } from "@/lib/storage/supabase";

import { publicKeyFor } from "./publishing";

/** What a public page needs to draw a photo (step 8.2): no optimizer, our own sizes. */
export type PublicPhoto = {
  src: string;
  srcSet: string;
  width: number;
  height: number;
  alt: string;
  /** The largest version, for Open Graph and the viewer. */
  large: string;
};

/** The columns of `media` a visitor can read (RLS: only public photos). */
export type PublicMediaRow = {
  public_key: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
};

const SIZES = Object.keys(MEDIA_WIDTHS) as MediaSize[];

/**
 * The three processed sizes of a public photo as `srcset`. Small originals are
 * never enlarged (sharp `withoutEnlargement`), so each width is capped by the
 * real one. Null when the photo is not public: the page simply leaves it out.
 */
export function toPublicPhoto(row: PublicMediaRow | null | undefined): PublicPhoto | null {
  if (!row?.public_key || !row.width || !row.height || !row.alt_text) return null;
  const key = row.public_key;
  const widths = SIZES.map((size) => ({ size, width: Math.min(MEDIA_WIDTHS[size], row.width!) }));
  const url = (size: MediaSize) => supabasePublicUrl(publicKeyFor(key, size));
  return {
    src: url("md"),
    srcSet: widths.map(({ size, width }) => `${url(size)} ${width}w`).join(", "),
    width: row.width,
    height: row.height,
    alt: row.alt_text,
    large: url("lg"),
  };
}
