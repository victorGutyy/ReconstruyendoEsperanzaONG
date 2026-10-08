import { describe, expect, it } from "vitest";

import { formatPostDate, parsePostFilters, publicPostsHref } from "./public-filters";

describe("public story filters", () => {
  it("reads the category and the page, ignoring anything odd", () => {
    expect(parsePostFilters({ categoria: "voces", pagina: "2" })).toEqual({
      category: "voces",
      page: 2,
    });
    expect(parsePostFilters({ categoria: "<script>", pagina: "0" })).toEqual({
      category: null,
      page: 1,
    });
  });

  it("builds addresses and goes back to page 1 when the category changes", () => {
    const filters = parsePostFilters({ categoria: "voces", pagina: "3" });
    expect(publicPostsHref(filters, { page: 4 })).toBe("/historias?categoria=voces&pagina=4");
    expect(publicPostsHref(filters, { category: "salud" })).toBe("/historias?categoria=salud");
    expect(publicPostsHref(filters, { category: null })).toBe("/historias");
  });

  it("dates stories in Colombia", () => {
    expect(formatPostDate("2026-10-06T03:00:00Z")).toBe("5 de octubre de 2026");
  });
});
