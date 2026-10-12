// Search engines (step 8.8, docs/07 §9): robots rules and structured data
// (JSON-LD). Pure, tested in seo.test.ts.

import type { MetadataRoute } from "next";

/**
 * Production: the public site may be indexed, never the panel, the search
 * results or the API. Anywhere else (staging, previews, local): nothing, so
 * a test copy never shows up on Google.
 */
export function robotsFor(isProduction: boolean, base: string): MetadataRoute.Robots {
  if (!isProduction) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/buscar", "/api"] }],
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}

/**
 * Description while the organization has not approved its own (Configuración
 * → SEO): says what the site holds, never what the organization claims.
 */
export const DEFAULT_DESCRIPTION =
  "Actividades, historias, proyectos y memoria de la organización en Calarcá, Quindío.";

type Thing = Record<string, unknown>;

/** The organization, on every public page (helps Google show it by its name). */
export function organizationLd(input: {
  name: string;
  url: string;
  logo: string;
  description?: string | null;
  email?: string | null;
  sameAs: string[];
}): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "NGO",
    name: input.name,
    url: input.url,
    logo: input.logo,
    ...(input.description ? { description: input.description } : {}),
    ...(input.email ? { email: input.email } : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: "Calarcá",
      addressRegion: "Quindío",
      addressCountry: "CO",
    },
    ...(input.sameAs.length > 0 ? { sameAs: input.sameAs } : {}),
  };
}

/** An activity as an event: date and the general place, never an address. */
export function eventLd(input: {
  name: string;
  url: string;
  startDate: string;
  endDate: string | null;
  description?: string | null;
  place: string | null;
  image?: string | null;
  organizer: { name: string; url: string };
}): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: input.name,
    url: input.url,
    startDate: input.startDate,
    ...(input.endDate ? { endDate: input.endDate } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: input.place ? `${input.place}, Calarcá` : "Calarcá, Quindío",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Calarcá",
        addressRegion: "Quindío",
        addressCountry: "CO",
      },
    },
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: [input.image] } : {}),
    organizer: { "@type": "NGO", name: input.organizer.name, url: input.organizer.url },
  };
}

/** A story as an article, signed only with its public byline. */
export function articleLd(input: {
  headline: string;
  url: string;
  datePublished: string;
  description?: string | null;
  byline?: string | null;
  image?: string | null;
  publisher: { name: string; url: string; logo: string };
}): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline.slice(0, 110),
    url: input.url,
    mainEntityOfPage: input.url,
    datePublished: input.datePublished,
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: [input.image] } : {}),
    author: input.byline
      ? { "@type": "Person", name: input.byline }
      : { "@type": "NGO", name: input.publisher.name, url: input.publisher.url },
    publisher: {
      "@type": "NGO",
      name: input.publisher.name,
      url: input.publisher.url,
      logo: { "@type": "ImageObject", url: input.publisher.logo },
    },
  };
}

/** "Inicio › Actividades › Título" for search results. */
export function breadcrumbLd(items: { name: string; url: string }[]): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * JSON for a <script type="application/ld+json">: "<" escaped so text typed in
 * the panel can never close the script tag.
 */
export const jsonLdText = (data: Thing | Thing[]) => JSON.stringify(data).replace(/</g, "\\u003c");
