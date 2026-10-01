import { z } from "zod";

import { POSTS_PATH } from "./schema";

// Panel list of stories (step 7.6a): filters read from the URL
// (?status=&category=&q=&mine=1&page=). Invalid values are ignored.
// Pure: unit-tested in list.test.ts.

export const POST_LIST_STATUSES = [
  "draft",
  "review",
  "scheduled",
  "published",
  "archived",
] as const;
export const POSTS_PAGE_SIZE = 20;
const MAX_PAGE = 500;

function optional<T extends z.ZodType>(schema: T) {
  return z
    .preprocess((value) => (value === "" ? undefined : value), schema.optional())
    .catch(undefined);
}

export const postFiltersSchema = z.object({
  status: optional(z.enum(POST_LIST_STATUSES)),
  category: optional(z.uuid()),
  q: z
    .string()
    .trim()
    .transform((text) => text.slice(0, 80))
    .catch(""),
  mine: z.preprocess((value) => value === "1", z.boolean()),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
});
export type PostFilters = z.output<typeof postFiltersSchema>;

export function parsePostFilters(
  searchParams: Record<string, string | string[] | undefined>,
): PostFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return postFiltersSchema.parse({
    status: first(searchParams.status),
    category: first(searchParams.category),
    q: first(searchParams.q) ?? "",
    mine: first(searchParams.mine),
    page: first(searchParams.page),
  });
}

/** URL of the list with some filters changed; any change goes back to page 1. */
export function postsHref(filters: PostFilters, changes: Partial<PostFilters> = {}): string {
  const next = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.category) params.set("category", next.category);
  if (next.q) params.set("q", next.q);
  if (next.mine) params.set("mine", "1");
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${POSTS_PATH}?${query}` : POSTS_PATH;
}

export const hasPostFilters = (filters: PostFilters) =>
  Boolean(filters.status || filters.category || filters.q || filters.mine);
