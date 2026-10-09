import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Memoria and search (step 8.6, HU-01, RF-A-12).
test.skip(!hasSupabase, "needs a local Supabase");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

async function axe(page: Page) {
  return (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations;
}

test("a published activity is in its year of the Memoria and found without accents", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const editor = await createTestUser("editor");
  // A word nothing else in the database has, to find exactly these rows
  const word = `zq${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const admin = adminClient();
  const { data: place } = await admin
    .from("places")
    .insert({ name: `[DEMO] Vereda ${word}`, slug: `demo-vereda-${word}`, kind: "vereda" })
    .select("id")
    .single();
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "activity", name: `[DEMO] Salud ${word}`, slug: `demo-salud-${word}` })
    .select("id")
    .single();
  const title = `[DEMO] Jornada de Salúd ${word}`;
  const { data: activity } = await admin
    .from("activities")
    .insert({
      title,
      slug: `demo-jornada-${word}`,
      status: "review",
      summary: "[DEMO] Atención básica para las familias.",
      starts_at: "2025-11-20T14:00:00Z",
      place_id: place!.id,
      category_id: category!.id,
      created_by: editor.id,
    })
    .select("id")
    .single();
  const draftTitle = `[DEMO] Jornada borrador ${word}`;
  await admin.from("activities").insert({
    title: draftTitle,
    slug: `demo-borrador-${word}`,
    starts_at: "2025-11-21T14:00:00Z",
  });

  // Published from the panel (this also refreshes the cached Memoria)
  await signInEnrollingMfa(page, editor);
  await page.goto(`/admin/actividades/${activity!.id}/editar?paso=4`);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page).toHaveURL(/\/listo\?estado=published$/);

  // Memoria: in 2025, with its place; the draft never
  await page.goto("/memoria");
  await page
    .getByRole("navigation", { name: "Filtrar la memoria" })
    .getByRole("link", { name: "Actividades" })
    .click();
  await expect(page).toHaveURL(/\/memoria\?tipo=actividades$/);
  const year = page.getByRole("region", { name: "2025" });
  await expect(year.getByRole("link", { name: title })).toBeVisible();
  await expect(year).toContainText(`[DEMO] Vereda ${word}`);
  await expect(page.getByText(draftTitle)).toHaveCount(0);
  expect(await axe(page)).toEqual([]);

  // Search, from the icon in the top bar: no accents, no capitals
  await page.getByRole("link", { name: "Buscar en el sitio" }).click();
  await expect(page).toHaveURL(/\/buscar$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.getByLabel("Qué buscas").fill(`JORNADA DE SALUD ${word}`);
  await page.getByRole("button", { name: "Buscar" }).click();
  const results = page.getByRole("region", { name: /1 resultado para/ });
  await expect(results.getByRole("link", { name: title })).toBeVisible();
  await expect(page.getByText(draftTitle)).toHaveCount(0);
  expect(await axe(page)).toEqual([]);

  await results.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
});

test("odd searches never fail, and too many in a minute are paused", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/buscar?q=a");
  await expect(page.getByText("Escribe al menos 2 letras.")).toBeVisible();

  const odd = encodeURIComponent(`agua" OR 1=1; drop table posts; -- ${randomUUID()}`);
  const response = await page.goto(`/buscar?q=${odd}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByText(/No encontramos nada para/)).toBeVisible();

  // Same visitor (same address): the 31st search in a minute is paused
  for (let i = 0; i < 29; i += 1) await page.goto(`/buscar?q=agua${i}`);
  await page.goto("/buscar?q=agua-final");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Hiciste muchas búsquedas seguidas",
  );
});
