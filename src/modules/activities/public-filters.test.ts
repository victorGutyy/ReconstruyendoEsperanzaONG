import { describe, expect, it } from "vitest";

import {
  formatActivityDate,
  formatActivityTime,
  hasFilters,
  parsePublicFilters,
  publicActivitiesHref,
  yearBounds,
  yearInColombia,
} from "./public-filters";

describe("public activity filters", () => {
  it("reads year, category, place and page from the address", () => {
    expect(
      parsePublicFilters({ ano: "2026", categoria: "salud", lugar: "la-huerta", pagina: "2" }),
    ).toEqual({ year: 2026, category: "salud", place: "la-huerta", page: 2 });
  });

  it("ignores anything odd instead of failing", () => {
    expect(
      parsePublicFilters({ ano: "abc", categoria: "Salud!", lugar: ["x", "y"], pagina: "-3" }),
    ).toEqual({ year: null, category: null, place: "x", page: 1 });
    expect(parsePublicFilters({ ano: "1500", pagina: "1.5" })).toMatchObject({
      year: null,
      page: 1,
    });
  });

  it("builds readable addresses and goes back to page 1 when a filter changes", () => {
    const filters = parsePublicFilters({ ano: "2026", pagina: "3" });
    expect(publicActivitiesHref(filters, { category: "salud" })).toBe(
      "/actividades?ano=2026&categoria=salud",
    );
    expect(publicActivitiesHref(filters, { page: 4 })).toBe("/actividades?ano=2026&pagina=4");
    expect(publicActivitiesHref(filters, { year: null })).toBe("/actividades");
    expect(hasFilters(filters)).toBe(true);
    expect(hasFilters(parsePublicFilters({}))).toBe(false);
  });
});

describe("dates in Colombia", () => {
  it("bounds a year by Colombian midnight", () => {
    expect(yearBounds(2026)).toEqual({
      from: "2026-01-01T05:00:00.000Z",
      to: "2027-01-01T05:00:00.000Z",
    });
    // 31 Dec, 11 p.m. in Bogotá is already 1 Jan in UTC
    expect(yearInColombia("2027-01-01T04:00:00Z")).toBe(2026);
  });

  it("shows one day, a range, and the time only when there is one", () => {
    expect(formatActivityDate("2026-10-12T13:00:00Z", null)).toBe("12 de octubre de 2026");
    expect(formatActivityDate("2026-10-12T13:00:00Z", "2026-10-14T22:00:00Z")).toBe(
      "12 de octubre de 2026 al 14 de octubre de 2026",
    );
    expect(formatActivityTime("2026-10-12T13:00:00Z")).toMatch(/^8:00\sa\.\s?m\.$/);
    expect(formatActivityTime("2026-10-12T05:00:00Z")).toBeNull();
  });
});
