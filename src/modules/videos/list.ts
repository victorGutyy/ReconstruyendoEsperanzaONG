import { z } from "zod";

import { PROVIDERS } from "./parse";
import { VIDEOS_PATH } from "./schema";

// Panel list of videos (step 7.6c): filters read from the URL
// (?status=&provider=&q=&mine=1&page=). Invalid values are ignored.
// Pure: unit-tested in schema.test.ts.

export const VIDEO_LIST_STATUSES = [
  "draft",
  "review",
  "scheduled",
  "published",
  "archived",
] as const;
export const VIDEOS_PAGE_SIZE = 20;
const MAX_PAGE = 500;

function optional<T extends z.ZodType>(schema: T) {
  return z
    .preprocess((value) => (value === "" ? undefined : value), schema.optional())
    .catch(undefined);
}

export const videoFiltersSchema = z.object({
  status: optional(z.enum(VIDEO_LIST_STATUSES)),
  provider: optional(z.enum(PROVIDERS)),
  q: z
    .string()
    .trim()
    .transform((text) => text.slice(0, 80))
    .catch(""),
  mine: z.preprocess((value) => value === "1", z.boolean()),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
});
export type VideoFilters = z.output<typeof videoFiltersSchema>;

export function parseVideoFilters(
  searchParams: Record<string, string | string[] | undefined>,
): VideoFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return videoFiltersSchema.parse({
    status: first(searchParams.status),
    provider: first(searchParams.provider),
    q: first(searchParams.q) ?? "",
    mine: first(searchParams.mine),
    page: first(searchParams.page),
  });
}

/** URL of the list with some filters changed; any change goes back to page 1. */
export function videosHref(filters: VideoFilters, changes: Partial<VideoFilters> = {}): string {
  const next = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.provider) params.set("provider", next.provider);
  if (next.q) params.set("q", next.q);
  if (next.mine) params.set("mine", "1");
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${VIDEOS_PATH}?${query}` : VIDEOS_PATH;
}

export const hasVideoFilters = (filters: VideoFilters) =>
  Boolean(filters.status || filters.provider || filters.q || filters.mine);
