import { expect, test } from "@playwright/test";

import { failOnCspViolations } from "../e2e/helpers/csp";

failOnCspViolations();

// Production smoke test (step 10.2): the public site answers, looks complete
// and keeps its protections. Read-only: no sign-in, no forms sent.

const production = !process.env.SMOKE_NOT_PRODUCTION;
const SECTIONS = [
  "/actividades",
  "/historias",
  "/proyectos",
  "/galeria",
  "/videos",
  "/memoria",
  "/quienes-somos",
  "/contacto",
];

test("the site and its database answer", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("the home page has its frame, menu and content", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeAttached();
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});

for (const path of SECTIONS) {
  test(`${path} opens`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  });
}

test("a detail page from the sitemap opens", async ({ page, request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const detail = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => new URL(match[1]!).pathname)
    .find((path) => /^\/(actividades|historias|proyectos|galeria)\/.+/.test(path));
  test.skip(!detail, "nothing published yet");
  const response = await page.goto(detail!);
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1").first()).toBeVisible();
});

test("the contact form is open and loads Turnstile", async ({ page }) => {
  await page.goto("/contacto");
  // Closed while the data policy is unpublished or a key is missing (docs/09)
  await expect(
    page.getByText("El formulario se habilitará cuando esté publicada la política"),
    "el formulario está cerrado: publicar la política de datos y revisar las claves de Turnstile",
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enviar mensaje" })).toBeVisible();
  await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toBeAttached({
    timeout: 20_000,
  });
});

test("an unknown address gives the friendly 404", async ({ page }) => {
  const response = await page.goto("/esta-pagina-no-existe");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1").first()).toBeVisible();
});

test("shared links get the default image", async ({ request }) => {
  const image = await request.get("/og");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
});

test("the protections are on", async ({ request }) => {
  const headers = (await request.get("/")).headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["strict-transport-security"]).toContain("max-age=63072000");
  if (production) {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow: \/admin/);
    expect(robots).not.toMatch(/^Disallow: \/\s*$/m);
  }
});
