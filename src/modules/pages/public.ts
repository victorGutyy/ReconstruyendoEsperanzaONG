import "server-only";

import { unstable_cache } from "next/cache";

import type { RichTextDoc } from "@/lib/rich-text/schema";
import { PUBLIC_CONTENT_TAG } from "@/lib/site/revalidate";
import { createPublicClient } from "@/lib/supabase/public";

import type { PageKey } from "./schema";

// The four fixed pages as visitors read them (step 8.5): only when published,
// so a page still waiting for its [PENDIENTE] text never reaches the site.

export type PublicPage = {
  title: string;
  body: RichTextDoc | null;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Legal pages: the version in force and since when. */
  version: string | null;
  publishedAt: string;
};

export const getPublicPage = unstable_cache(
  async (key: PageKey): Promise<PublicPage | null> => {
    const { data, error } = await createPublicClient()
      .from("pages")
      .select("title, body, seo_title, seo_description, version, published_at")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    if (!data?.published_at) return null;
    return {
      title: data.title,
      body: data.body as RichTextDoc | null,
      seoTitle: data.seo_title,
      seoDescription: data.seo_description,
      version: data.version,
      publishedAt: data.published_at,
    };
  },
  ["public-pages", "page"],
  { tags: [PUBLIC_CONTENT_TAG], revalidate: 300 },
);
