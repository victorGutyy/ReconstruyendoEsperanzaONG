import { z } from "zod";

import { GALLERIES_PATH } from "./schema";

// Panel list of galleries (step 7.6c): filters read from the URL
// (?status=&q=&mine=1&page=). Invalid values are ignored.
// Pure: unit-tested in schema.test.ts.

export const GALLERY_LIST_STATUSES = [
  "draft",
  "review",
  "scheduled",
  "published",
  "archived",
] as const;
export const GALLERIES_PAGE_SIZE = 20;
const MAX_PAGE = 500;

function optional<T extends z.ZodType>(schema: T) {
  return z
    .preprocess((value) => (value === "" ? undefined : value), schema.optional())
    .catch(undefined);
}

export const galleryFiltersSchema = z.object({
  status: optional(z.enum(GALLERY_LIST_STATUSES)),
  q: z
    .string()
    .trim()
    .transform((text) => text.slice(0, 80))
    .catch(""),
  mine: z.preprocess((value) => value === "1", z.boolean()),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
});
export type GalleryFilters = z.output<typeof galleryFiltersSchema>;

export function parseGalleryFilters(
  searchParams: Record<string, string | string[] | undefined>,
): GalleryFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return galleryFiltersSchema.parse({
    status: first(searchParams.status),
    q: first(searchParams.q) ?? "",
    mine: first(searchParams.mine),
    page: first(searchParams.page),
  });
}

/** URL of the list with some filters changed; any change goes back to page 1. */
export function galleriesHref(
  filters: GalleryFilters,
  changes: Partial<GalleryFilters> = {},
): string {
  const next = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.q) params.set("q", next.q);
  if (next.mine) params.set("mine", "1");
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${GALLERIES_PATH}?${query}` : GALLERIES_PATH;
}

export const hasGalleryFilters = (filters: GalleryFilters) =>
  Boolean(filters.status || filters.q || filters.mine);
