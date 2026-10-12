import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { signInEnrollingMfa } from "./helpers/session";
import { failOnCspViolations } from "./helpers/csp";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

failOnCspViolations();

// Search engines and sharing (step 8.8, docs/07 §9).

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

const jsonLd = async (page: import("@playwright/test").Page) =>
  (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
    (text) => JSON.parse(text) as Record<string, unknown> | Record<string, unknown>[],
  );

test("outside production nothing may be indexed; the default sharing image exists", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/User-Agent: \*\s+Disallow: \//i);

  const image = await request.get("/og");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
});

test("every public page names the organization for search engines", async ({ page }) => {
  await page.goto("/");
  const data = (await jsonLd(page)).flat();
  expect(data).toContainEqual(
    expect.objectContaining({ "@type": "NGO", name: "Reconstruyendo Esperanza" }),
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /^https?:\/\/[^/]+\/og$/,
  );
});

test("a published activity is in the sitemap, as an event with its general place", async ({
  page,
  request,
}) => {
  test.skip(!hasSupabase, "needs a local Supabase");
  test.setTimeout(120_000);
  const editor = await createTestUser("editor");
  const tag = randomUUID().slice(0, 6);
  const admin = adminClient();
  const { data: place } = await admin
    .from("places")
    .insert({ name: `[DEMO] Vereda ${tag}`, slug: `demo-vereda-${tag}`, kind: "vereda" })
    .select("id")
    .single();
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "activity", name: `[DEMO] Salud ${tag}`, slug: `demo-salud-${tag}` })
    .select("id")
    .single();
  const slug = `demo-seo-${tag}`;
  const { data: activity } = await admin
    .from("activities")
    .insert({
      title: `[DEMO] Jornada SEO ${tag}`,
      slug,
      status: "review",
      starts_at: "2026-09-20T14:00:00Z",
      place_id: place!.id,
      category_id: category!.id,
      created_by: editor.id,
    })
    .select("id")
    .single();
  await admin.from("activities").insert({
    title: `[DEMO] Borrador SEO ${tag}`,
    slug: `demo-borrador-seo-${tag}`,
    status: "draft",
    starts_at: "2026-09-21T14:00:00Z",
  });

  // Published from the panel: this also refreshes the cached sitemap
  await signInEnrollingMfa(page, editor);
  await page.goto(`/admin/actividades/${activity!.id}/editar?paso=4`);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page).toHaveURL(/\/listo\?estado=published$/);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`/actividades/${slug}</loc>`);
  expect(sitemap).not.toContain(`demo-borrador-seo-${tag}`);
  expect(sitemap).not.toContain("/admin");

  await page.goto(`/actividades/${slug}`);
  const data = (await jsonLd(page)).flat();
  expect(data).toContainEqual(
    expect.objectContaining({
      "@type": "Event",
      startDate: "2026-09-20T14:00:00+00:00",
      location: expect.objectContaining({ name: `[DEMO] Vereda ${tag}, Calarcá` }),
    }),
  );
  expect(data).toContainEqual(expect.objectContaining({ "@type": "BreadcrumbList" }));
  // No cover: WhatsApp gets the default image
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /^https?:\/\/[^/]+\/og$/,
  );
});
