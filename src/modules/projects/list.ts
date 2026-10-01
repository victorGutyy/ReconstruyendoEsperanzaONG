import { z } from "zod";

import { PROJECT_STAGES, PROJECTS_PATH } from "./schema";

// Panel list of projects (step 7.6b): filters read from the URL
// (?status=&stage=&q=&mine=1&page=). Invalid values are ignored.
// Pure: unit-tested in schema.test.ts.

export const PROJECT_LIST_STATUSES = [
  "draft",
  "review",
  "scheduled",
  "published",
  "archived",
] as const;
export const PROJECTS_PAGE_SIZE = 20;
const MAX_PAGE = 500;

function optional<T extends z.ZodType>(schema: T) {
  return z
    .preprocess((value) => (value === "" ? undefined : value), schema.optional())
    .catch(undefined);
}

export const projectFiltersSchema = z.object({
  status: optional(z.enum(PROJECT_LIST_STATUSES)),
  /** The project's own state (planned, active…). */
  stage: optional(z.enum(PROJECT_STAGES)),
  q: z
    .string()
    .trim()
    .transform((text) => text.slice(0, 80))
    .catch(""),
  mine: z.preprocess((value) => value === "1", z.boolean()),
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
});
export type ProjectFilters = z.output<typeof projectFiltersSchema>;

export function parseProjectFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ProjectFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return projectFiltersSchema.parse({
    status: first(searchParams.status),
    stage: first(searchParams.stage),
    q: first(searchParams.q) ?? "",
    mine: first(searchParams.mine),
    page: first(searchParams.page),
  });
}

/** URL of the list with some filters changed; any change goes back to page 1. */
export function projectsHref(
  filters: ProjectFilters,
  changes: Partial<ProjectFilters> = {},
): string {
  const next = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.stage) params.set("stage", next.stage);
  if (next.q) params.set("q", next.q);
  if (next.mine) params.set("mine", "1");
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${PROJECTS_PATH}?${query}` : PROJECTS_PATH;
}

export const hasProjectFilters = (filters: ProjectFilters) =>
  Boolean(filters.status || filters.stage || filters.q || filters.mine);
