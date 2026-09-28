// URL slugs shared by taxonomy and content. Pure: tested in slug.test.ts.

/**
 * "Barrio La Ñ" → "barrio-la-n". Accents and ñ become plain letters, anything
 * else becomes a hyphen. Returns "" when the text has no letters or numbers.
 */
export function slugify(text: string, maxLength = 80): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");
}

/**
 * First free slug: "base", then "base-2", "base-3"… `taken` holds the slugs
 * already in use that start with the base.
 */
export function uniqueSlug(base: string, taken: ReadonlySet<string>, maxLength = 120): string {
  const root = base.slice(0, maxLength - 4).replace(/-+$/, "") || "sin-titulo";
  if (!taken.has(root)) return root;
  for (let n = 2; ; n += 1) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
