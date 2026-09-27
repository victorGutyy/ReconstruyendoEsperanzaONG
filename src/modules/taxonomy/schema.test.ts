import { describe, expect, it } from "vitest";

import {
  createCategorySchema,
  createPlaceSchema,
  moveInOrder,
  slugify,
  trashSchema,
  updatePlaceSchema,
} from "./schema";

const id = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("slugify", () => {
  it("turns accents, ñ and spaces into a clean slug", () => {
    expect(slugify("Barrio La Ñ")).toBe("barrio-la-n");
    expect(slugify("  Vereda   El Túnel  ")).toBe("vereda-el-tunel");
    expect(slugify("Salud & Bienestar!")).toBe("salud-bienestar");
    expect(slugify("[DEMO] Niñez")).toBe("demo-ninez");
  });

  it("returns an empty slug when there are no letters or numbers", () => {
    expect(slugify("¿?¡!")).toBe("");
  });

  it("caps the length without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(79)} bcd`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("place schemas", () => {
  it("accepts a place and trims the name", () => {
    expect(createPlaceSchema.parse({ name: "  Barrio Centro ", kind: "neighborhood" })).toEqual({
      name: "Barrio Centro",
      kind: "neighborhood",
    });
  });

  it("rejects unknown kinds, empty names and names without letters", () => {
    expect(createPlaceSchema.safeParse({ name: "Casa 12", kind: "address" }).success).toBe(false);
    expect(createPlaceSchema.safeParse({ name: "   ", kind: "other" }).success).toBe(false);
    expect(createPlaceSchema.safeParse({ name: "¿?", kind: "other" }).success).toBe(false);
  });

  it("reads the active checkbox", () => {
    const base = { id, name: "Barrio", kind: "neighborhood" };
    expect(updatePlaceSchema.parse({ ...base, active: "on" }).active).toBe(true);
    expect(updatePlaceSchema.parse({ ...base, active: null }).active).toBe(false);
  });
});

describe("category schemas", () => {
  it("stores an empty description as null", () => {
    expect(
      createCategorySchema.parse({ scope: "post", name: "Salud", description: "  " }).description,
    ).toBeNull();
  });

  it("rejects scopes other than activities and posts", () => {
    expect(
      createCategorySchema.safeParse({ scope: "page", name: "Salud", description: "" }).success,
    ).toBe(false);
  });
});

describe("trashSchema", () => {
  it("only accepts taxonomy tables", () => {
    expect(trashSchema.safeParse({ table: "places", id }).success).toBe(true);
    expect(trashSchema.safeParse({ table: "profiles", id }).success).toBe(false);
  });
});

describe("moveInOrder", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("swaps an item with its neighbour", () => {
    expect(moveInOrder(items, "b", "up")?.map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(moveInOrder(items, "b", "down")?.map((item) => item.id)).toEqual(["a", "c", "b"]);
  });

  it("does not move past the ends or unknown ids", () => {
    expect(moveInOrder(items, "a", "up")).toBeNull();
    expect(moveInOrder(items, "c", "down")).toBeNull();
    expect(moveInOrder(items, "x", "up")).toBeNull();
  });
});
