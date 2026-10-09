// Public search (step 8.6, RF-A-12): what is a valid search. Pure, tested in
// schema.test.ts. The text goes to Postgres as a value for
// websearch_to_tsquery, never as SQL.

export const SEARCH_PATH = "/buscar";
export const SEARCH_PAGE_SIZE = 10;
export const SEARCH_MIN = 2;
export const SEARCH_MAX = 100;

export type SearchRequest = { query: string; page: number } | null;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The search in the address, or null when there is nothing to look for. */
export function parseSearch(params: Record<string, string | string[] | undefined>): SearchRequest {
  // Control characters out, spaces collapsed
  const query = (first(params.q) ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX);
  if (query.length < SEARCH_MIN) return null;
  const page = Number(first(params.pagina));
  return { query, page: Number.isInteger(page) && page >= 1 && page <= 50 ? page : 1 };
}

export function searchHref(query: string, page = 1): string {
  const params = new URLSearchParams({ q: query });
  if (page > 1) params.set("pagina", String(page));
  return `${SEARCH_PATH}?${params.toString()}`;
}
