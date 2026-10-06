import { describe, expect, it } from "vitest";

import {
  isTrashableType,
  isTrashKind,
  kindName,
  parseTrashFilter,
  purgeSchema,
  TRASH_KINDS,
} from "./schema";

const id = "11111111-1111-4111-8111-111111111111";

describe("trash kinds", () => {
  it("takes every content type but the fixed pages, and photos", () => {
    expect(isTrashableType("post")).toBe(true);
    expect(isTrashableType("team_member")).toBe(true);
    expect(isTrashableType("page")).toBe(false);
    expect(isTrashableType("media")).toBe(false);
    expect(isTrashKind("media")).toBe(true);
    expect(isTrashKind("toString")).toBe(false);
    expect(TRASH_KINDS).not.toContain("page");
  });

  it("names one item of each kind", () => {
    expect(kindName("post")).toBe("Historia");
    expect(kindName("team_member")).toBe("Persona del equipo");
    expect(kindName("media")).toBe("Foto");
  });

  it("reads the filter from the address, ignoring anything else", () => {
    expect(parseTrashFilter("video")).toBe("video");
    expect(parseTrashFilter(["media", "post"])).toBe("media");
    expect(parseTrashFilter("page")).toBeNull();
    expect(parseTrashFilter(undefined)).toBeNull();
  });
});

describe("purge confirmation", () => {
  it("requires the exact word", () => {
    expect(purgeSchema.safeParse({ kind: "post", id, confirmation: " ELIMINAR " }).success).toBe(
      true,
    );
    const wrong = purgeSchema.safeParse({ kind: "post", id, confirmation: "eliminar" });
    expect(wrong.success).toBe(false);
    expect(wrong.error?.issues[0]?.message).toBe("Escribe ELIMINAR para confirmar.");
  });

  it("refuses pages and invalid ids", () => {
    expect(purgeSchema.safeParse({ kind: "page", id, confirmation: "ELIMINAR" }).success).toBe(
      false,
    );
    expect(purgeSchema.safeParse({ kind: "post", id: "x", confirmation: "ELIMINAR" }).success).toBe(
      false,
    );
  });
});
