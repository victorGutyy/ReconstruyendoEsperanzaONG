import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";

import { goToSection } from "./helpers/panel";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Publishing an activity from the phone, steps 1 and 2 (step 7.3a, docs/07 §6.5)
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

/** A [DEMO] place and activity category with unique names for this test. */
async function taxonomy() {
  const tag = randomUUID().slice(0, 6);
  const admin = adminClient();
  const { data: place } = await admin
    .from("places")
    .insert({ name: `[DEMO] Vereda ${tag}`, slug: `demo-vereda-${tag}`, kind: "vereda" })
    .select("id, name")
    .single();
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "activity", name: `[DEMO] Jornada ${tag}`, slug: `demo-jornada-${tag}` })
    .select("id, name")
    .single();
  return { place: place!, category: category! };
}

function photo(color: string) {
  return sharp({ create: { width: 1600, height: 1200, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
}

test("an editor creates an activity with its story and photos", async ({ page }) => {
  const editor = await createTestUser("editor");
  const { place, category } = await taxonomy();
  await signInEnrollingMfa(page, editor);

  await goToSection(page, "Actividades");
  await page.getByRole("main").getByRole("link", { name: "Nueva actividad" }).click();
  await expect(page.getByRole("heading", { name: "Nueva actividad", level: 1 })).toBeVisible();
  expect(await axe(page)).toEqual([]);

  // Step 1 · Lo básico
  const title = `[DEMO] Jornada de siembra ${randomUUID().slice(0, 6)}`;
  await page.getByRole("textbox", { name: "Título", exact: true }).fill(title);
  await page.getByLabel("Fecha").fill("2026-09-20");
  await page.getByLabel("Hora de inicio").fill("09:30");
  await page.getByRole("button", { name: "Agregar hora de fin" }).click();
  await page.getByLabel("Hora de fin (opcional)").fill("12:00");
  await page.getByLabel("Lugar general").selectOption(place.id);
  await page.getByLabel("Categoría").selectOption(category.id);
  await page.getByLabel("Resumen").fill("[DEMO] Sembramos árboles nativos con la comunidad.");

  const story = page.getByRole("textbox", { name: "Relato" });
  await story.click();
  await page.keyboard.type("Sembramos ");
  await page.getByRole("button", { name: "Negrita" }).click();
  // Like a person: type once the button is on and the story has the focus again
  await expect(page.getByRole("button", { name: "Negrita" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(story).toBeFocused();
  await story.pressSequentially("50 árboles");
  await page.getByRole("button", { name: "Siguiente" }).click();

  await expect(page).toHaveURL(/\/admin\/actividades\/[0-9a-f-]+\/editar\?paso=2$/);
  const activityId = page.url().match(/actividades\/([0-9a-f-]+)\//)![1]!;

  // Step 2 · Fotos
  await expect(page.getByRole("heading", { name: "Fotos de la actividad (0)" })).toBeVisible();
  await page.getByLabel(/Tomar o elegir fotos/).setInputFiles([
    { name: "uno.jpg", mimeType: "image/jpeg", buffer: await photo("#6b8f5e") },
    { name: "dos.jpg", mimeType: "image/jpeg", buffer: await photo("#b79a4b") },
    { name: "tres.jpg", mimeType: "image/jpeg", buffer: await photo("#245745") },
  ]);
  const photos = page.getByRole("list", { name: "Fotos de la actividad" });
  await expect(photos.getByRole("listitem")).toHaveCount(3, { timeout: 30_000 });
  await expect(photos.getByRole("listitem").first()).toContainText("Portada");
  expect(await axe(page)).toEqual([]);

  await page.getByLabel("Descripción de la foto 1").fill("[DEMO] Personas sembrando");
  await page.getByLabel("Descripción de la foto 1").blur();
  await expect(page.getByText("Descripción guardada.")).toBeVisible();

  await page.getByRole("button", { name: "Usar como portada: Foto 2" }).click();
  await expect(photos.getByRole("listitem").nth(1)).toContainText("Portada");
  await page.getByRole("button", { name: "Subir: Foto 3" }).click();
  await page
    .getByRole("button", { name: "Quitar de la actividad: [DEMO] Personas sembrando" })
    .click();
  await expect(photos.getByRole("listitem")).toHaveCount(2);

  // What was saved
  const { data: activity } = await adminClient()
    .from("activities")
    .select(
      "status, title, starts_at, ends_at, place_id, category_id, body, body_text, created_by, cover_media_id, activity_media(media_id, position)",
    )
    .eq("id", activityId)
    .single();
  expect(activity).toMatchObject({
    status: "draft",
    title,
    starts_at: "2026-09-20T14:30:00+00:00",
    ends_at: "2026-09-20T17:00:00+00:00",
    place_id: place.id,
    category_id: category.id,
    body_text: "Sembramos 50 árboles",
    created_by: editor.id,
  });
  expect(JSON.stringify(activity!.body)).toContain('"type":"bold"');
  expect(activity!.activity_media).toHaveLength(2);
  expect(activity!.activity_media.map((link) => link.media_id)).toContain(activity!.cover_media_id);
});

test("a draft is saved automatically and recovered after losing the signal", async ({
  page,
  context,
}) => {
  const author = await createTestUser("author");
  await signInEnrollingMfa(page, author);
  await page.goto("/admin/actividades/nueva");

  await page
    .getByRole("textbox", { name: "Título", exact: true })
    .fill(`[DEMO] Taller ${randomUUID().slice(0, 6)}`);
  await page.getByLabel("Fecha").fill("2026-10-05");
  await page.getByLabel("Hora de inicio").fill("15:00");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/\/editar\?paso=1$/);

  // Autosave a few seconds after typing
  await page.getByLabel("Resumen").fill("[DEMO] Guardado solo");
  await expect(page.getByText(/Guardado a las/)).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByLabel("Resumen")).toHaveValue("[DEMO] Guardado solo");

  // Without signal the text stays on the phone and comes back
  await context.setOffline(true);
  await page.getByLabel("Resumen").fill("[DEMO] Escrito sin señal");
  await expect(page.getByText(/se guardó una copia en este dispositivo/).first()).toBeVisible({
    timeout: 10_000,
  });
  await context.setOffline(false);
  await page.reload();

  await expect(page.getByLabel("Resumen")).toHaveValue("[DEMO] Guardado solo");
  await expect(page.getByText("Recuperamos lo que escribiste sin conexión")).toBeVisible();
  await page.getByRole("button", { name: "Usar esta versión" }).click();
  await expect(page.getByLabel("Resumen")).toHaveValue("[DEMO] Escrito sin señal");
  await expect(page.getByText(/Guardado a las/)).toBeVisible({ timeout: 10_000 });
});
