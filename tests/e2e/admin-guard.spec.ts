import { expect, test } from "@playwright/test";

// src/proxy.ts on the production build: optimistic redirects for /admin (docs/04 §5.1)
test.describe("Admin panel guard", () => {
  test("sends a visitor without a session from /admin to the login", async ({ request }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe("/admin/login?next=%2Fadmin");
  });

  test("remembers the requested panel page", async ({ request }) => {
    const response = await request.get("/admin/usuarios?pagina=2", { maxRedirects: 0 });

    expect(response.headers()["location"]).toBe(
      "/admin/login?next=%2Fadmin%2Fusuarios%3Fpagina%3D2",
    );
  });

  test("does not redirect the login page itself", async ({ request }) => {
    const response = await request.get("/admin/login?next=https://evil.example", {
      maxRedirects: 0,
    });

    expect(response.status()).not.toBe(307);
    expect(response.headers()["location"]).toBeUndefined();
  });

  test("leaves the public site alone", async ({ request }) => {
    const response = await request.get("/", { maxRedirects: 0 });

    expect(response.status()).toBe(200);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });
});
