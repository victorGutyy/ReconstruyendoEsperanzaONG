import { describe, expect, it } from "vitest";

import { parseSearch, searchHref } from "./schema";

describe("parseSearch", () => {
  it("cleans the text and keeps the page", () => {
    expect(parseSearch({ q: "  jornada   de\tsalud ", pagina: "2" })).toEqual({
      query: "jornada de salud",
      page: 2,
    });
  });

  it("ignores searches too short and odd pages", () => {
    expect(parseSearch({ q: "a" })).toBeNull();
    expect(parseSearch({})).toBeNull();
    expect(parseSearch({ q: "agua", pagina: "999" })).toEqual({ query: "agua", page: 1 });
  });

  it("caps the length", () => {
    expect(parseSearch({ q: "x".repeat(500) })?.query).toHaveLength(100);
  });
});

describe("searchHref", () => {
  it("encodes the text", () => {
    expect(searchHref("salud & agua", 2)).toBe("/buscar?q=salud+%26+agua&pagina=2");
  });
});
