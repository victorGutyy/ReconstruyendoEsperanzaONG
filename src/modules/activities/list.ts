import { z } from "zod";

// Panel list of activities (step 7.4): filters read from the URL
// (?status=&category=&place=&q=&mine=1&page=). Anything invalid is ignored
// instead of failing: the URL is user-editable. Pure: unit-tested in list.test.ts.

export const LIST_STATUSES = ["draft", "review", "scheduled", "published", "archived"] as const;
export type ListStatus = (typeof LIST_STATUSES)[number];

export const ACTIVITIES_PATH = "/admin/actividades";
export const ACTIVITIES_PAGE_SIZE = 20;
const MAX_PAGE = 500;
const MAX_QUERY = 80;

function optional<T extends z.ZodType>(schema: T) {
  return z
    .preprocess((value) => (value === "" ? undefined : value), schema.optional())
    .catch(undefined);
}

export const activityFiltersSchema = z.object({
  status: optional(z.enum(LIST_STATUSES)),
  category: optional(z.uuid()),
  place: optional(z.uuid()),
  q: z
    .string()
    .trim()
    .transform((text) => text.slice(0, MAX_QUERY))
    .catch(""),
  mine: z.preprocess((value) => value === "1", z.boolean()),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
});
export type ActivityFilters = z.output<typeof activityFiltersSchema>;

/** searchParams can repeat a key (?a=1&a=2): keep the first value only. */
export function parseActivityFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ActivityFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return activityFiltersSchema.parse({
    status: first(searchParams.status),
    category: first(searchParams.category),
    place: first(searchParams.place),
    q: first(searchParams.q) ?? "",
    mine: first(searchParams.mine),
    page: first(searchParams.page),
  });
}

/** URL of the list with some filters changed; any change goes back to page 1. */
export function activitiesHref(
  filters: ActivityFilters,
  changes: Partial<ActivityFilters> = {},
): string {
  const next = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.category) params.set("category", next.category);
  if (next.place) params.set("place", next.place);
  if (next.q) params.set("q", next.q);
  if (next.mine) params.set("mine", "1");
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${ACTIVITIES_PATH}?${query}` : ACTIVITIES_PATH;
}

export const hasFilters = (filters: ActivityFilters) =>
  Boolean(filters.status || filters.category || filters.place || filters.q || filters.mine);
