// Public activities (step 8.2): filters from the address and dates in
// Colombia. Pure, unit-tested in public-filters.test.ts.

export const PUBLIC_ACTIVITIES_PATH = "/actividades";
export const PAST_PAGE_SIZE = 12;

export type PublicActivityFilters = {
  year: number | null;
  category: string | null;
  place: string | null;
  page: number;
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Anything odd in the address is ignored, never an error page. */
export function parsePublicFilters(
  params: Record<string, string | string[] | undefined>,
): PublicActivityFilters {
  const year = Number(first(params.ano));
  const page = Number(first(params.pagina));
  const slug = (value: string | undefined) =>
    value && value.length <= 80 && SLUG.test(value) ? value : null;
  return {
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null,
    category: slug(first(params.categoria)),
    place: slug(first(params.lugar)),
    page: Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

/** The listing address with these filters (page 1 unless given). */
export function publicActivitiesHref(
  filters: PublicActivityFilters,
  change: Partial<PublicActivityFilters> = {},
): string {
  const next = { ...filters, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.year) params.set("ano", String(next.year));
  if (next.category) params.set("categoria", next.category);
  if (next.place) params.set("lugar", next.place);
  if (next.page > 1) params.set("pagina", String(next.page));
  const query = params.toString();
  return query ? `${PUBLIC_ACTIVITIES_PATH}?${query}` : PUBLIC_ACTIVITIES_PATH;
}

export const hasFilters = (filters: PublicActivityFilters) =>
  Boolean(filters.year || filters.category || filters.place);

/** Colombia has no daylight saving time: always UTC−5. */
const BOGOTA_OFFSET = "-05:00";

/** [start, end) of a year in Colombia, as ISO instants. */
export function yearBounds(year: number): { from: string; to: string } {
  return {
    from: new Date(`${year}-01-01T00:00:00${BOGOTA_OFFSET}`).toISOString(),
    to: new Date(`${year + 1}-01-01T00:00:00${BOGOTA_OFFSET}`).toISOString(),
  };
}

/** The year of an instant in Colombia (31 Dec 11 p.m. is still that year). */
export function yearInColombia(iso: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "America/Bogota" }).format(
      new Date(iso),
    ),
  );
}

const DAY = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});
const TIME = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/** "12 de octubre de 2026", or a range when it lasts several days. */
export function formatActivityDate(startsAt: string, endsAt: string | null): string {
  const start = DAY.format(new Date(startsAt));
  if (!endsAt) return start;
  const end = DAY.format(new Date(endsAt));
  return end === start ? start : `${start} al ${end}`;
}

/** "8:00 a. m.", or null at midnight (a date without a time). */
export function formatActivityTime(startsAt: string): string | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    timeZone: "America/Bogota",
  }).formatToParts(new Date(startsAt));
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  if (hour === "00" && minute === "00") return null;
  return TIME.format(new Date(startsAt));
}
