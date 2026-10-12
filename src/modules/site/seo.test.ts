import { describe, expect, it } from "vitest";

import { articleLd, breadcrumbLd, eventLd, jsonLdText, organizationLd, robotsFor } from "./seo";

const base = "https://example.test";

describe("robotsFor", () => {
  it("lets search engines in only in production, never into the panel", () => {
    expect(robotsFor(true, base)).toEqual({
      rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/buscar", "/api"] }],
      sitemap: "https://example.test/sitemap.xml",
    });
  });

  it("blocks everything on staging and previews", () => {
    expect(robotsFor(false, base)).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
  });
});

describe("structured data", () => {
  const organizer = { name: "Reconstruyendo Esperanza", url: base };

  it("describes the organization with its networks", () => {
    const ld = organizationLd({
      ...organizer,
      logo: `${base}/logo.png`,
      sameAs: ["https://facebook.com/x"],
    });
    expect(ld).toMatchObject({ "@type": "NGO", sameAs: ["https://facebook.com/x"] });
    expect(organizationLd({ ...organizer, logo: "l", sameAs: [] })).not.toHaveProperty("sameAs");
  });

  it("places an activity in its general place, never an address", () => {
    const ld = eventLd({
      name: "Jornada",
      url: `${base}/actividades/jornada`,
      startDate: "2026-10-12T13:00:00Z",
      endDate: null,
      place: "Vereda La Huerta",
      organizer,
    });
    expect(ld).toMatchObject({
      "@type": "Event",
      location: { name: "Vereda La Huerta, Calarcá", address: { addressLocality: "Calarcá" } },
    });
    expect(ld).not.toHaveProperty("endDate");
  });

  it("signs a story with its byline or the organization", () => {
    const publisher = { ...organizer, logo: "l" };
    const signed = articleLd({
      headline: "H",
      url: base,
      datePublished: "d",
      byline: "Ana",
      publisher,
    });
    expect(signed.author).toEqual({ "@type": "Person", name: "Ana" });
    const unsigned = articleLd({ headline: "H", url: base, datePublished: "d", publisher });
    expect(unsigned.author).toMatchObject({ "@type": "NGO" });
  });

  it("numbers the breadcrumbs", () => {
    expect(
      breadcrumbLd([
        { name: "Inicio", url: base },
        { name: "Actividades", url: `${base}/actividades` },
      ]).itemListElement,
    ).toEqual([
      { "@type": "ListItem", position: 1, name: "Inicio", item: base },
      { "@type": "ListItem", position: 2, name: "Actividades", item: `${base}/actividades` },
    ]);
  });

  it("never lets typed text close the script tag", () => {
    expect(jsonLdText({ name: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
