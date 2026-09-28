import { describe, expect, it } from "vitest";

import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("turns accents, ñ and spaces into a clean slug", () => {
    expect(slugify("Jornada de Siembra en La Ñ")).toBe("jornada-de-siembra-en-la-n");
  });
});

describe("uniqueSlug", () => {
  it("adds the first free number", () => {
    expect(uniqueSlug("jornada", new Set())).toBe("jornada");
    expect(uniqueSlug("jornada", new Set(["jornada", "jornada-2"]))).toBe("jornada-3");
  });

  it("never returns an empty slug", () => {
    expect(uniqueSlug("", new Set())).toBe("sin-titulo");
  });
});
