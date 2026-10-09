import { describe, expect, it } from "vitest";

import { formatMemoryDay, memoryHref, memoryItemHref, parseMemoryKind } from "./schema";

describe("Memoria", () => {
  it("reads the kind from the address, ignoring anything else", () => {
    expect(parseMemoryKind("historias")).toBe("post");
    expect(parseMemoryKind(["proyectos"])).toBe("project");
    expect(parseMemoryKind("nada")).toBeNull();
    expect(parseMemoryKind(undefined)).toBeNull();
  });

  it("builds the filter and item addresses", () => {
    expect(memoryHref(null)).toBe("/memoria");
    expect(memoryHref("activity")).toBe("/memoria?tipo=actividades");
    expect(memoryItemHref("post", "la-quebrada")).toBe("/historias/la-quebrada");
  });

  it("dates items in Colombia", () => {
    expect(formatMemoryDay("2026-10-13T03:00:00Z")).toMatch(/^12 oct$/);
  });
});
