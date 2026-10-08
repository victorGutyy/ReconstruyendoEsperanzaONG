import "server-only";

import { unstable_cache } from "next/cache";

import { PUBLIC_CONTENT_TAG } from "@/lib/site/revalidate";
import { createPublicClient } from "@/lib/supabase/public";
import { type PublicMediaRow, type PublicPhoto, toPublicPhoto } from "@/modules/media";

// What visitors see of galleries (step 8.4). Read as an anonymous visitor:
// only published albums, only their public photos, and the activity or
// project they belong to only while it is published. Cached 5 minutes.

export const PUBLIC_GALLERIES_PATH = "/galeria";
export const GALLERIES_PAGE_SIZE = 12;

const cached = <Args extends unknown[], Result>(
  name: string,
  fn: (...args: Args) => Promise<Result>,
) =>
  unstable_cache(fn, ["public-galleries", name], { tags: [PUBLIC_CONTENT_TAG], revalidate: 300 });

const CARD_COLUMNS =
  "id, slug, title, description, published_at, cover:media!galleries_cover_media_id_fkey(public_key, width, height, alt_text), gallery_items(media(public_key))";

type CardRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  published_at: string;
  cover: PublicMediaRow | null;
  gallery_items: { media: { public_key: string | null } | null }[];
};

export type GalleryCard = {
  id: string;
  slug: string;
  title: string;
  publishedAt: string;
  /** Only the photos visitors can see. */
  photoCount: number;
  cover: PublicPhoto | null;
};

const toCard = (row: CardRow): GalleryCard => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  publishedAt: row.published_at,
  photoCount: row.gallery_items.filter((item) => item.media?.public_key).length,
  cover: toPublicPhoto(row.cover),
});

export type GalleryListing = { galleries: GalleryCard[]; pageCount: number };

/** Albums, newest first, a page at a time. */
export const listPublicGalleries = cached(
  "listing",
  async (page: number): Promise<GalleryListing> => {
    const offset = (page - 1) * GALLERIES_PAGE_SIZE;
    const { data, error, count } = await createPublicClient()
      .from("galleries")
      .select(CARD_COLUMNS, { count: "exact" })
      .order("published_at", { ascending: false })
      .range(offset, offset + GALLERIES_PAGE_SIZE - 1);
    // Asking for a page past the end is not an error: it is empty
    if (error && error.code !== "PGRST103") throw error;
    return {
      galleries: error ? [] : (data as unknown as CardRow[]).map(toCard),
      pageCount: Math.ceil((count ?? 0) / GALLERIES_PAGE_SIZE),
    };
  },
);

/** The published albums of a project, newest first. */
export const listProjectGalleries = cached(
  "of-project",
  async (projectId: string): Promise<GalleryCard[]> => {
    const { data, error } = await createPublicClient()
      .from("galleries")
      .select(CARD_COLUMNS)
      .eq("project_id", projectId)
      .order("published_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as CardRow[]).map(toCard);
  },
);

export type PublicGallery = GalleryCard & {
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Where it comes from, only while that activity or project is published. */
  owner: { kind: "activity" | "project"; title: string; slug: string } | null;
  photos: (PublicPhoto & { caption: string | null })[];
};

/** One published album by its address, or null (404). */
export const getPublicGallery = cached(
  "detail",
  async (slug: string): Promise<PublicGallery | null> => {
    const { data, error } = await createPublicClient()
      .from("galleries")
      .select(
        `${CARD_COLUMNS}, seo_title, seo_description, activity:activities(title, slug), project:projects(title, slug), items:gallery_items(position, caption, media(public_key, width, height, alt_text, caption))`,
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const row = data as unknown as CardRow & {
      seo_title: string | null;
      seo_description: string | null;
      activity: { title: string; slug: string } | null;
      project: { title: string; slug: string } | null;
      items: {
        position: number;
        caption: string | null;
        media: (PublicMediaRow & { caption: string | null }) | null;
      }[];
    };
    return {
      ...toCard(row),
      description: row.description,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      owner: row.activity
        ? { kind: "activity", ...row.activity }
        : row.project
          ? { kind: "project", ...row.project }
          : null,
      // Photos that lost their authorization are not public: they are left out
      photos: [...row.items]
        .sort((a, b) => a.position - b.position)
        .flatMap((item) => {
          const photo = toPublicPhoto(item.media);
          return photo ? [{ ...photo, caption: item.caption ?? item.media?.caption ?? null }] : [];
        }),
    };
  },
);
