import { z } from "zod";

// Audit viewer filters, read from the URL (?actor=&action=&section=&from=&to=&page=).
// Anything invalid is ignored instead of failing: the URL is user-editable.

export const AUDIT_ACTIONS = [
  "insert",
  "update",
  "delete",
  "soft_delete",
  "restore",
  "publish",
  "unpublish",
  "role_change",
  "status_change",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Audited tables. Each new audited table (F7+) is added here and in format.ts. */
export const AUDIT_SECTIONS = [
  "profiles",
  "places",
  "categories",
  "tags",
  "media",
  "consent_records",
  "media_consents",
  "activities",
  "activity_media",
  "activity_tags",
  "posts",
  "projects",
  "galleries",
  "gallery_items",
  "videos",
  "testimonials",
  "team_members",
] as const;
export type AuditSection = (typeof AUDIT_SECTIONS)[number];

/** Filter value for entries without a person (Supabase Auth, migrations). */
export const SYSTEM_ACTOR = "sistema";

export const PAGE_SIZE = 25;
const MAX_PAGE = 1000;

const isoDate = z.iso.date();

function optional<T extends z.ZodType>(schema: T) {
  return z
    .preprocess((value) => (value === "" ? undefined : value), schema.optional())
    .catch(undefined);
}

export const auditFiltersSchema = z
  .object({
    actor: optional(z.union([z.literal(SYSTEM_ACTOR), z.uuid()])),
    action: optional(z.enum(AUDIT_ACTIONS)),
    section: optional(z.enum(AUDIT_SECTIONS)),
    from: optional(isoDate),
    to: optional(isoDate),
    page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
  })
  .transform((filters) =>
    // A reversed range is treated as the user meant it: swap the ends
    filters.from && filters.to && filters.from > filters.to
      ? { ...filters, from: filters.to, to: filters.from }
      : filters,
  );

export type AuditFilters = z.output<typeof auditFiltersSchema>;

/** searchParams can repeat a key (?a=1&a=2): keep the first value only. */
export function parseAuditFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AuditFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  return auditFiltersSchema.parse({
    actor: first(searchParams.actor),
    action: first(searchParams.action),
    section: first(searchParams.section),
    from: first(searchParams.from),
    to: first(searchParams.to),
    page: first(searchParams.page),
  });
}

// Colombia has no daylight saving time: a day always starts at 00:00 -05:00.
const BOGOTA_OFFSET = "-05:00";

/** [start, end) instants for the date range, in Colombian time. */
export function dateRangeBounds(filters: Pick<AuditFilters, "from" | "to">): {
  gte?: string;
  lt?: string;
} {
  const bounds: { gte?: string; lt?: string } = {};
  if (filters.from) bounds.gte = `${filters.from}T00:00:00${BOGOTA_OFFSET}`;
  if (filters.to) {
    const next = new Date(`${filters.to}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    bounds.lt = `${next.toISOString().slice(0, 10)}T00:00:00${BOGOTA_OFFSET}`;
  }
  return bounds;
}

/** URL for another page of the same filtered list. */
export function auditHref(filters: AuditFilters, page: number): string {
  const params = new URLSearchParams();
  for (const key of ["actor", "action", "section", "from", "to"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/auditoria?${query}` : "/admin/auditoria";
}
