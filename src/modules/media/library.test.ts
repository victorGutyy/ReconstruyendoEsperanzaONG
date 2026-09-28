import { describe, expect, it } from "vitest";

import { describeIssues, libraryHref, parseLibraryFilters, updateMediaSchema } from "./library";

const id = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("describeIssues", () => {
  it("explains each pending item in plain Spanish", () => {
    expect(describeIssues(["missing_alt_text", "missing_guardian_consent"])).toEqual([
      expect.objectContaining({ code: "missing_alt_text", badge: "Falta descripción" }),
      expect.objectContaining({
        code: "missing_guardian_consent",
        badge: "Falta autorización del representante",
      }),
    ]);
  });

  it("keeps unknown codes with a generic label", () => {
    expect(describeIssues(["something_new"])[0]).toMatchObject({ badge: "Revisar" });
  });
});

describe("library filters", () => {
  it("reads flags and the page from the URL", () => {
    expect(parseLibraryFilters({ mine: "1", pending: "1", page: "3" })).toEqual({
      mine: true,
      pending: true,
      trash: false,
      page: 3,
    });
  });

  it("ignores anything else", () => {
    expect(parseLibraryFilters({ mine: "yes", trash: ["1", "0"], page: "-4" })).toEqual({
      mine: false,
      pending: false,
      trash: true,
      page: 1,
    });
  });

  it("builds links that reset the page when a filter changes", () => {
    const filters = parseLibraryFilters({ mine: "1", page: "4" });
    expect(libraryHref(filters, { pending: true })).toBe("/admin/medios?mine=1&pending=1");
    expect(libraryHref(filters, { page: 5 })).toBe("/admin/medios?mine=1&page=5");
    expect(libraryHref(parseLibraryFilters({}))).toBe("/admin/medios");
  });
});

describe("updateMediaSchema", () => {
  it("trims texts and stores empty ones as null", () => {
    expect(
      updateMediaSchema.parse({
        id,
        altText: "  Personas sembrando árboles ",
        caption: "",
        credit: " [DEMO] Equipo ",
        people: "identifiable",
      }),
    ).toEqual({
      id,
      altText: "Personas sembrando árboles",
      caption: null,
      credit: "[DEMO] Equipo",
      people: "identifiable",
    });
  });

  it("keeps a photo unclassified when no option is chosen", () => {
    expect(
      updateMediaSchema.parse({ id, altText: "", caption: "", credit: "", people: null }).people,
    ).toBeNull();
  });

  it("rejects unknown options and very long descriptions", () => {
    const base = { id, altText: "x", caption: "", credit: "" };
    expect(updateMediaSchema.safeParse({ ...base, people: "crowd" }).success).toBe(false);
    expect(
      updateMediaSchema.safeParse({ ...base, altText: "a".repeat(301), people: "none" }).success,
    ).toBe(false);
  });
});
