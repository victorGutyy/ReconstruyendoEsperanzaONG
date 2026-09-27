import { describe, expect, it } from "vitest";

import { isActivePath, navFor } from "./navigation";

const labels = (permissions: string[], isActive = true) =>
  navFor({ isActive, permissions }).map((item) => item.label);

describe("navFor", () => {
  it("shows every existing section to an admin", () => {
    expect(labels(["users.manage", "audit.read"])).toEqual(["Inicio", "Usuarios", "Auditoría"]);
  });

  it("shows only Inicio to an author", () => {
    expect(labels(["content.read", "content.create"])).toEqual(["Inicio"]);
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
