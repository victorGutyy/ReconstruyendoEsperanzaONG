import "server-only";

import { unstable_cache } from "next/cache";

import { PUBLIC_CONTENT_TAG } from "@/lib/site/revalidate";
import { createPublicClient } from "@/lib/supabase/public";
import { type PublicMediaRow, type PublicPhoto, toPublicPhoto } from "@/modules/media";

// Testimonials as visitors see them (step 8.5): only published ones whose
// authorization is still valid (the RLS checks it), newest first.

export type PublicTestimonial = {
  id: string;
  quote: string;
  /** What the site shows, e.g. "María" or "M. G." (decision 7.6d). */
  author: string;
  context: string | null;
  photo: PublicPhoto | null;
};

export const listPublicTestimonials = unstable_cache(
  async (): Promise<PublicTestimonial[]> => {
    const { data, error } = await createPublicClient()
      .from("testimonials")
      .select(
        "id, quote, author_display_name, author_context, photo:media!testimonials_cover_media_id_fkey(public_key, width, height, alt_text)",
      )
      .order("published_at", { ascending: false });
    if (error) throw error;
    type Row = {
      id: string;
      quote: string;
      author_display_name: string;
      author_context: string | null;
      photo: PublicMediaRow | null;
    };
    return (data as unknown as Row[]).map((row) => ({
      id: row.id,
      quote: row.quote,
      author: row.author_display_name,
      context: row.author_context,
      photo: toPublicPhoto(row.photo),
    }));
  },
  ["public-testimonials", "list"],
  { tags: [PUBLIC_CONTENT_TAG], revalidate: 300 },
);
