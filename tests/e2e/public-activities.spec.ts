import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { createTestPhoto } from "./helpers/media";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Public activities (step 8.2, HU-01, HU-02): what is published from the panel
// shows on the site at once, drafts never do, and retiring takes it down.
test.skip(!hasSupabase, "needs a local Supabase with Storage");

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

test("a published activity appears on the site with its photo; a draft never does", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const editor = await createTestUser("editor");
  const tag = randomUUID().slice(0, 6);
  const admin = adminClient();
  const { data: place } = await admin
    .from("places")
    .insert({ name: `[DEMO] Vereda ${tag}`, slug: `demo-vereda-${tag}`, kind: "vereda" })
    .select("id")
    .single();
  const categorySlug = `demo-salud-${tag}`;
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "activity", name: `[DEMO] Salud ${tag}`, slug: categorySlug })
    .select("id")
    .single();
  const alt = `[DEMO] Mesa de atención ${tag}`;
  const mediaId = await createTestPhoto(editor.id, { alt_text: alt, people_in_photo: "none" });
  const title = `[DEMO] Jornada de salud ${tag}`;
  const slug = `demo-jornada-${tag}`;
  const { data: activity } = await admin
    .from("activities")
    .insert({
      title,
      slug,
      summary: "[DEMO] Atención básica para las familias de la vereda.",
      results: "[DEMO] 40 personas atendidas.",
      starts_at: "2026-09-20T14:00:00Z",
      created_by: editor.id,
      place_id: place!.id,
      category_id: category!.id,
      cover_media_id: mediaId,
    })
    .select("id")
    .single();
  await admin
    .from("activity_media")
    .insert({ activity_id: activity!.id, media_id: mediaId, position: 1 });
  const draftTitle = `[DEMO] Borrador ${tag}`;
  await admin.from("activities").insert({
    title: draftTitle,
    slug: `demo-borrador-${tag}`,
    starts_at: "2026-09-21T14:00:00Z",
    category_id: category!.id,
  });

  // Nothing public yet
  expect((await page.goto(`/actividades/${slug}`))?.status()).toBe(404);

  await signInEnrollingMfa(page, editor);
  await page.goto(`/admin/actividades/${activity!.id}/editar?paso=4`);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page).toHaveURL(/\/listo\?estado=published$/);

  // The listing, filtered by its category: published yes, draft no
  await page.goto("/actividades");
  await page.getByLabel("Categoría").selectOption(categorySlug);
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(new RegExp(`/actividades\\?ano=&categoria=${categorySlug}`));
  const past = page.getByRole("region", { name: "Realizadas" });
  await expect(past.getByRole("link", { name: title })).toBeVisible();
  await expect(page.getByText(draftTitle)).toHaveCount(0);
  expect(await axe(page)).toEqual([]);

  // The detail: facts, results, the photo in the viewer
  await past.getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`/actividades/${slug}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByRole("region", { name: "Ficha" })).toContainText(`[DEMO] Vereda ${tag}`);
  await expect(page.getByRole("region", { name: "Resultados" })).toContainText(
    "40 personas atendidas",
  );
  expect(await axe(page)).toEqual([]);

  const opener = page
    .getByRole("list", { name: "Fotos de la actividad" })
    .getByRole("button", { name: /Ver foto 1 de 1/ });
  await opener.click();
  const viewer = page.getByRole("dialog", { name: "Foto 1 de 1" });
  await expect(viewer.getByRole("img", { name: alt })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(opener).toBeFocused();

  // What WhatsApp reads (HU-02)
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/media-public\/[0-9a-f-]{36}\/lg\.webp$/,
  );
  await expect(page.getByRole("link", { name: /WhatsApp/ }).first()).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/\?text=/,
  );

  // Retired from the panel: gone from the site at once
  await page.goto(`/admin/actividades/${activity!.id}/editar`);
  await page.getByRole("button", { name: "Retirar para corregir" }).click();
  await page
    .getByRole("dialog", { name: "Retirar para corregir" })
    .getByRole("button", { name: "Retirar del sitio" })
    .click();
  await expect(page.getByText("Actividad · Borrador")).toBeVisible();
  expect((await page.goto(`/actividades/${slug}`))?.status()).toBe(404);
});

test("odd filters in the address show an empty result, never an error", async ({ page }) => {
  const response = await page.goto("/actividades?ano=abc&categoria=no-existe&pagina=99");
  expect(response?.status()).toBe(200);
  await expect(page.getByText("No hay actividades con estos filtros.")).toBeVisible();
  await page.getByRole("link", { name: "Ver todas las actividades" }).click();
  await expect(page).toHaveURL(/\/actividades$/);
});
