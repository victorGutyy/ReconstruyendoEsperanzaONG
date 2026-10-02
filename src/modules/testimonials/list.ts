import { z } from "zod";

import { TESTIMONIALS_PATH } from "./schema";

// Panel list of testimonials (step 7.6d): filters read from the URL
// (?status=&q=&mine=1&withdrawn=1&page=). Invalid values are ignored.
// Pure: unit-tested in schema.test.ts.

export const TESTIMONIAL_LIST_STATUSES = [
  "draft",
  "review",
  "scheduled",
  "published",
  "archived",
] as const;
export const TESTIMONIALS_PAGE_SIZE = 20;
const MAX_PAGE = 500;

function optional<T extends z.ZodType>(schema: T) {
  return z
    .preprocess((value) => (value === "" ? undefined : value), schema.optional())
    .catch(undefined);
}

export const testimonialFiltersSchema = z.object({
  status: optional(z.enum(TESTIMONIAL_LIST_STATUSES)),
  q: z
    .string()
    .trim()
    .transform((text) => text.slice(0, 80))
    .catch(""),
  mine: z.preprocess((value) => value === "1", z.boolean()),
  /** Published with an authorization that was revoked or expired. */
  withdrawn: z.preprocess((value) => value === "1", z.boolean()),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
});
export type TestimonialFilters = z.output<typeof testimonialFiltersSchema>;

export function parseTestimonialFilters(
  searchParams: Record<string, string | string[] | undefined>,
): TestimonialFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return testimonialFiltersSchema.parse({
    status: first(searchParams.status),
    q: first(searchParams.q) ?? "",
    mine: first(searchParams.mine),
    withdrawn: first(searchParams.withdrawn),
    page: first(searchParams.page),
  });
}

/** URL of the list with some filters changed; any change goes back to page 1. */
export function testimonialsHref(
  filters: TestimonialFilters,
  changes: Partial<TestimonialFilters> = {},
): string {
  const next = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.q) params.set("q", next.q);
  if (next.mine) params.set("mine", "1");
  if (next.withdrawn) params.set("withdrawn", "1");
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${TESTIMONIALS_PATH}?${query}` : TESTIMONIALS_PATH;
}

export const hasTestimonialFilters = (filters: TestimonialFilters) =>
  Boolean(filters.status || filters.q || filters.mine || filters.withdrawn);
