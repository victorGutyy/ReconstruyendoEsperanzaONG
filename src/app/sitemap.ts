import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site/url";
import { createPublicClient } from "@/lib/supabase/public";
import { getPublicPage, PAGE_ADDRESSES, type PageKey } from "@/modules/pages";

// What search engines may find (step 8.8, docs/07 §9): read as a visitor, so
// only published content whose date arrived. Refreshed with the public site.
export const revalidate = 300;

const SECTIONS = [
  "/",
  "/actividades",
  "/historias",
  "/proyectos",
  "/memoria",
  "/galeria",
  "/videos",
  "/contacto",
];

const CONTENT = [
  { table: "activities", base: "/actividades" },
  { table: "posts", base: "/historias" },
  { table: "projects", base: "/proyectos" },
  { table: "galleries", base: "/galeria" },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient();
  const [content, pages] = await Promise.all([
    Promise.all(
      CONTENT.map(async ({ table, base }) => {
        const { data, error } = await supabase.from(table).select("slug, updated_at");
        if (error) throw error;
        return data.map((row) => ({
          url: absoluteUrl(`${base}/${row.slug}`),
          lastModified: row.updated_at,
        }));
      }),
    ),
    // The fixed pages only once published (never with [PENDIENTE] text)
    Promise.all(
      (Object.keys(PAGE_ADDRESSES) as PageKey[]).map(async (key) =>
        (await getPublicPage(key))
          ? { url: absoluteUrl(PAGE_ADDRESSES[key]), lastModified: undefined }
          : null,
      ),
    ),
  ]);

  return [
    ...SECTIONS.map((path) => ({ url: absoluteUrl(path) })),
    ...pages.filter((page) => page !== null),
    ...content.flat(),
  ];
}
