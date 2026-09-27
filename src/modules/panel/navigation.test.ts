import { describe, expect, it } from "vitest";

import { isActivePath, navFor } from "./navigation";

const labels = (permissions: string[], isActive = true) =>
  navFor({ isActive, permissions }).map((item) => item.label);

describe("navFor", () => {
  it("shows every existing section to an admin", () => {
    expect(labels(["media.upload", "taxonomy.manage", "users.manage", "audit.read"])).toEqual([
      "Inicio",
      "Medios",
      "Categorías y lugares",
      "Usuarios",
      "Auditoría",
    ]);
  });

  it("shows the taxonomy to an editor, but not users or audit", () => {
    expect(labels(["content.read", "media.upload", "taxonomy.manage", "consent.manage"])).toEqual([
      "Inicio",
      "Medios",
      "Categorías y lugares",
    ]);
  });

  it("shows Inicio and Medios to an author", () => {
    expect(labels(["content.read", "content.create", "media.upload"])).toEqual([
      "Inicio",
      "Medios",
    ]);
  });

  it("hides everything but Inicio from a deactivated profile", () => {
    expect(labels(["users.manage", "audit.read"], false)).toEqual(["Inicio"]);
  });

  it("shows only Inicio without a profile", () => {
    expect(navFor(null).map((item) => item.label)).toEqual(["Inicio"]);
  });
});

describe("isActivePath", () => {
  it("marks Inicio only on the panel home", () => {
    expect(isActivePath("/admin", "/admin")).toBe(true);
    expect(isActivePath("/admin/usuarios", "/admin")).toBe(false);
  });

  it("marks a section on its sub-pages, not on look-alike paths", () => {
    expect(isActivePath("/admin/usuarios", "/admin/usuarios")).toBe(true);
    expect(isActivePath("/admin/usuarios/123", "/admin/usuarios")).toBe(true);
    expect(isActivePath("/admin/usuarios-viejos", "/admin/usuarios")).toBe(false);
  });
});
