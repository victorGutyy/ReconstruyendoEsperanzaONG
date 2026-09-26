import { describe, expect, it } from "vitest";

import { decideAdminRoute, hasPermission, PERMISSIONS, safeNextPath } from "./rules";

describe("safeNextPath", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/", "/admin"],
    ["/admin/usuarios", "/admin/usuarios"],
    ["/admin/contenido?estado=borrador", "/admin/contenido?estado=borrador"],
    ["/admin/a/../usuarios", "/admin/usuarios"],
  ])("accepts the internal panel path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    ["an external URL", "https://evil.example/admin"],
    ["a protocol-relative URL", "//evil.example/admin"],
    ["a backslash trick", "/\\evil.example"],
    ["a backslash after admin", "/admin\\..\\..\\evil"],
    ["a javascript URL", "javascript:alert(1)"],
    ["an encoded tab trick", "/\t/evil.example"],
    ["a path outside the panel", "/actividades"],
    ["a traversal that leaves the panel", "/admin/../actividades"],
    ["a look-alike prefix", "/administrator"],
    ["the login page (loop)", "/admin/login"],
    ["the MFA page (loop)", "/admin/mfa"],
    ["an empty value", ""],
    ["a very long value", `/admin/${"a".repeat(600)}`],
  ])("rejects %s", (_label, input) => {
    expect(safeNextPath(input)).toBeNull();
  });

  it("rejects null and undefined", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});

describe("decideAdminRoute", () => {
  describe("without a session", () => {
    it("lets the login and recovery pages through", () => {
      expect(decideAdminRoute({ pathname: "/admin/login", session: null })).toEqual({
        type: "next",
      });
      expect(decideAdminRoute({ pathname: "/admin/recuperar", session: null })).toEqual({
        type: "next",
      });
    });

    it("sends protected pages to the login, remembering where the user was going", () => {
      expect(
        decideAdminRoute({ pathname: "/admin/usuarios", search: "?pagina=2", session: null }),
      ).toEqual({ type: "redirect", to: "/admin/login?next=%2Fadmin%2Fusuarios%3Fpagina%3D2" });
    });

    it("protects the panel home", () => {
      expect(decideAdminRoute({ pathname: "/admin", session: null })).toEqual({
        type: "redirect",
        to: "/admin/login?next=%2Fadmin",
      });
    });

    it("protects the MFA page", () => {
      expect(decideAdminRoute({ pathname: "/admin/mfa", session: null })).toEqual({
        type: "redirect",
        to: "/admin/login",
      });
    });
  });

  describe("with a password-only session (aal1)", () => {
    const session = { aal: "aal1" as const };

    it("lets the MFA page through", () => {
      expect(decideAdminRoute({ pathname: "/admin/mfa", session })).toEqual({ type: "next" });
    });

    it("sends every other panel page to MFA", () => {
      expect(decideAdminRoute({ pathname: "/admin/usuarios", session })).toEqual({
        type: "redirect",
        to: "/admin/mfa?next=%2Fadmin%2Fusuarios",
      });
      expect(decideAdminRoute({ pathname: "/admin/login", session })).toEqual({
        type: "redirect",
        to: "/admin/mfa",
      });
    });
  });

  describe("with a full session (aal2)", () => {
    const session = { aal: "aal2" as const };

    it("lets panel pages through", () => {
      expect(decideAdminRoute({ pathname: "/admin/usuarios", session })).toEqual({ type: "next" });
    });

    it("moves the user away from the login and MFA screens", () => {
      expect(decideAdminRoute({ pathname: "/admin/login", session })).toEqual({
        type: "redirect",
        to: "/admin",
      });
      expect(decideAdminRoute({ pathname: "/admin/mfa", session })).toEqual({
        type: "redirect",
        to: "/admin",
      });
    });

    it("honours a safe ?next= after signing in", () => {
      expect(
        decideAdminRoute({ pathname: "/admin/mfa", search: "?next=%2Fadmin%2Fusuarios", session }),
      ).toEqual({ type: "redirect", to: "/admin/usuarios" });
    });

    it("ignores an unsafe ?next= after signing in", () => {
      expect(
        decideAdminRoute({
          pathname: "/admin/login",
          search: "?next=https%3A%2F%2Fevil.example",
          session,
        }),
      ).toEqual({ type: "redirect", to: "/admin" });
    });
  });
});

describe("hasPermission", () => {
  const editor = { isActive: true, permissions: ["content.read", "content.publish"] };

  it("grants a permission the role has", () => {
    expect(hasPermission(editor, "content.publish")).toBe(true);
  });

  it("denies a permission the role lacks", () => {
    expect(hasPermission(editor, "users.manage")).toBe(false);
  });

  it("denies everything to a deactivated user", () => {
    expect(hasPermission({ ...editor, isActive: false }, "content.read")).toBe(false);
  });

  it("denies everything without a profile", () => {
    expect(hasPermission(null, "content.read")).toBe(false);
  });

  it("knows the 17 permissions of docs/06", () => {
    expect(PERMISSIONS).toHaveLength(17);
  });
});

describe("decideAdminRoute — password recovery", () => {
  it("always lets the e-mail link handler through", () => {
    for (const session of [null, { aal: "aal1" as const }, { aal: "aal2" as const }]) {
      expect(decideAdminRoute({ pathname: "/admin/auth/confirm", session })).toEqual({
        type: "next",
      });
    }
  });

  it("requires a session to set a new password", () => {
    expect(decideAdminRoute({ pathname: "/admin/restablecer", session: null })).toEqual({
      type: "redirect",
      to: "/admin/login?next=%2Fadmin%2Frestablecer",
    });
  });

  it("lets the recovery session (aal1) set a new password before MFA", () => {
    expect(decideAdminRoute({ pathname: "/admin/restablecer", session: { aal: "aal1" } })).toEqual({
      type: "next",
    });
  });
});
