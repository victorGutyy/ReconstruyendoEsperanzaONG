// Launch check (step 10.1, docs/08 §5): before announcing the site, and after
// each production deploy, nothing may show a [PENDIENTE] or [DEMO] marker and
// the basics must be in place.
//
//   npm run check:launch -- https://<dominio>
//   npm run check:launch -- http://127.0.0.1:3100 --not-production
//
// --not-production skips what only holds on the real site (indexing allowed,
// enforced CSP with HSTS). Reads pages only: it never writes anything.

/** Pages that exist without content; the rest come from the sitemap. */
export const FIXED_PAGES = [
  "/",
  "/actividades",
  "/historias",
  "/proyectos",
  "/galeria",
  "/videos",
  "/memoria",
  "/quienes-somos",
  "/apoyanos",
  "/contacto",
  "/legal/politica-de-datos",
  "/legal/aviso-de-privacidad",
];

const MARKER = /\[(?:PENDIENTE|DEMO)\b[^\]]{0,120}\]/g;

/**
 * Placeholder markers anywhere in a page, metadata and structured data
 * included, each with the words that follow it ("[DEMO] Jornada de…").
 */
export function findMarkers(html) {
  const text = html
    // Tags go, their attribute values stay: descriptions and sharing titles
    // live in <meta content="…">
    .replace(
      /<[^>]*>/g,
      (tag) => ` ${[...tag.matchAll(/=\s*"([^"]*)"/g)].map((m) => m[1]).join(" ")} `,
    )
    .replace(/&quot;|\\"/g, '"')
    .replace(/\s+/g, " ");
  const found = [...text.matchAll(MARKER)].map((match) => {
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 40);
    return `${match[0]}${after.split(/["<{}[]/)[0].trimEnd()}`.trim();
  });
  return [...new Set(found)];
}

/** Page addresses from a sitemap, moved to the site being checked. */
export function sitemapPaths(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
    const url = new URL(match[1].trim());
    return url.pathname + url.search;
  });
}

/** The security headers every page must send (docs/05 §8). */
export function headerProblems(headers, { production }) {
  const problems = [];
  if (headers.get("x-frame-options") !== "DENY") problems.push("X-Frame-Options no es DENY");
  if (headers.get("x-content-type-options") !== "nosniff") problems.push("falta nosniff");
  if (!headers.get("referrer-policy")) problems.push("falta Referrer-Policy");
  if (headers.get("x-powered-by")) problems.push("anuncia el framework (X-Powered-By)");
  if (production) {
    if (!headers.get("content-security-policy"))
      problems.push("la CSP no es obligatoria (Content-Security-Policy)");
    if (!headers.get("strict-transport-security")?.includes("max-age=63072000")) {
      problems.push("falta HSTS de 2 años");
    }
  } else if (
    !headers.get("content-security-policy") &&
    !headers.get("content-security-policy-report-only")
  ) {
    problems.push("falta la CSP");
  }
  return problems;
}

/** Search engines may index the public site, never the panel (docs/07 §9). */
export function robotsProblems(text) {
  const problems = [];
  if (/^Disallow:\s*\/\s*$/im.test(text)) problems.push("robots.txt bloquea todo el sitio");
  if (!/^Disallow:\s*\/admin\s*$/im.test(text)) problems.push("robots.txt no bloquea /admin");
  if (!/^Sitemap:/im.test(text)) problems.push("robots.txt no enlaza el sitemap");
  return problems;
}

/**
 * Runs every check against `base`; returns the problems found, by page.
 * @param {string} base
 * @param {{ production?: boolean, extraPages?: string[], fetchImpl?: typeof fetch }} [options]
 */
export async function checkLaunch(
  base,
  { production = true, extraPages = [], fetchImpl = fetch } = {},
) {
  const site = base.replace(/\/$/, "");
  const problems = [];
  const get = (path) => fetchImpl(site + path, { redirect: "follow" });

  const health = await get("/api/health");
  if (!health.ok) problems.push({ page: "/api/health", problem: `responde ${health.status}` });

  const home = await get("/");
  for (const problem of headerProblems(home.headers, { production })) {
    problems.push({ page: "/", problem });
  }

  if (production) {
    for (const problem of robotsProblems(await (await get("/robots.txt")).text())) {
      problems.push({ page: "/robots.txt", problem });
    }
  }

  const sitemap = await get("/sitemap.xml");
  const fromSitemap = sitemap.ok ? sitemapPaths(await sitemap.text()) : [];
  if (!sitemap.ok) problems.push({ page: "/sitemap.xml", problem: `responde ${sitemap.status}` });
  const pages = [...new Set([...FIXED_PAGES, ...fromSitemap, ...extraPages])];

  for (const page of pages) {
    const response = await get(page);
    if (!response.ok) {
      // A fixed page answers 404 while its approved text is not published
      const hint = response.status === 404 ? " (¿página sin publicar?)" : "";
      problems.push({ page, problem: `responde ${response.status}${hint}` });
      continue;
    }
    for (const marker of findMarkers(await response.text())) {
      problems.push({ page, problem: `muestra ${marker}` });
    }
  }
  return { pages: pages.length, problems };
}

async function main() {
  const args = process.argv.slice(2);
  const base = args.find((arg) => !arg.startsWith("--"));
  if (!base) {
    console.error("Uso: npm run check:launch -- https://<dominio> [--not-production]");
    process.exit(2);
  }
  const production = !args.includes("--not-production");
  const { pages, problems } = await checkLaunch(base, { production });
  if (problems.length === 0) {
    console.log(`✔ ${pages} páginas revisadas en ${base}: listo para lanzar.`);
    return;
  }
  console.error(`✘ ${problems.length} problema(s) en ${pages} páginas de ${base}:`);
  for (const { page, problem } of problems) console.error(`  ${page}: ${problem}`);
  process.exit(1);
}

// Run as a command (npm run check:launch), not when the tests import it
if (/check-launch\.mjs$/.test(process.argv[1] ?? "")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
