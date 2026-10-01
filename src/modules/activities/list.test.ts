import { describe, expect, it } from "vitest";

import { activitiesHref, hasFilters, parseActivityFilters } from "./list";

const ID = "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";

describe("parseActivityFilters", () => {
  it("reads every filter from the URL", () => {
    expect(
      parseActivityFilters({
        status: "review",
        category: ID,
        place: ID,
        q: "  siembra  ",
        mine: "1",
        withdrawn: "1",
        page: "3",
      }),
    ).toEqual({
      status: "review",
      category: ID,
      place: ID,
      q: "siembra",
      mine: true,
      withdrawn: true,
      page: 3,
    });
  });

  it("ignores invalid values instead of failing", () => {
    expect(
      parseActivityFilters({
        status: "deleted",
        category: "x",
        place: "1",
        mine: "yes",
        page: "-2",
      }),
    ).toEqual({
      status: undefined,
      category: undefined,
      place: undefined,
      q: "",
      mine: false,
      withdrawn: false,
      page: 1,
    });
  });

  it("keeps the first value of a repeated key and caps the search text", () => {
    const filters = parseActivityFilters({ status: ["draft", "review"], q: "a".repeat(200) });
    expect(filters.status).toBe("draft");
    expect(filters.q).toHaveLength(80);
  });
});

describe("activitiesHref", () => {
  const empty = parseActivityFilters({});

  it("is the bare path without filters", () => {
    expect(activitiesHref(empty)).toBe("/admin/actividades");
    expect(hasFilters(empty)).toBe(false);
  });

  it("goes back to page 1 when a filter changes", () => {
    const filters = parseActivityFilters({ status: "draft", page: "4" });
    expect(activitiesHref(filters, { mine: true })).toBe("/admin/actividades?status=draft&mine=1");
    expect(activitiesHref(filters, { page: 5 })).toBe("/admin/actividades?status=draft&page=5");
    expect(activitiesHref(filters, { withdrawn: true })).toBe(
      "/admin/actividades?status=draft&withdrawn=1",
    );
  });

  it("encodes the search text", () => {
    expect(activitiesHref(empty, { q: "día & noche" })).toBe(
      "/admin/actividades?q=d%C3%ADa+%26+noche",
    );
  });
});
