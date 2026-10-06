import "server-only";

/**
 * The address of the public site, for links shared outside it (WhatsApp, Open
 * Graph). NEXT_PUBLIC_SITE_URL when set; otherwise the address Vercel gives the
 * deployment, so staging works without configuring anything (step 8.2).
 */
export function siteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured);
  const vercel =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : (process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL);
  if (vercel) return new URL(`https://${vercel}`);
  return new URL(`http://localhost:${process.env.PORT ?? 3000}`);
}

/** Absolute address of a path of the site. */
export const absoluteUrl = (path: string) => new URL(path, siteUrl()).toString();
