// Public stories (step 8.3): address filters and dates. Pure, tested in
// public-filters.test.ts.

export const PUBLIC_POSTS_PATH = "/historias";
export const POSTS_PAGE_SIZE = 9;

export type PublicPostFilters = { category: string | null; page: number };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Anything odd in the address is ignored, never an error page. */
export function parsePostFilters(
  params: Record<string, string | string[] | undefined>,
): PublicPostFilters {
  const category = first(params.categoria);
  const page = Number(first(params.pagina));
  return {
    category: category && category.length <= 80 && SLUG.test(category) ? category : null,
    page: Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

export function publicPostsHref(
  filters: PublicPostFilters,
  change: Partial<PublicPostFilters> = {},
): string {
  const next = { ...filters, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.category) params.set("categoria", next.category);
  if (next.page > 1) params.set("pagina", String(next.page));
  const query = params.toString();
  return query ? `${PUBLIC_POSTS_PATH}?${query}` : PUBLIC_POSTS_PATH;
}

const DAY = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});

/** "5 de octubre de 2026", in Colombia. */
export const formatPostDate = (iso: string) => DAY.format(new Date(iso));
