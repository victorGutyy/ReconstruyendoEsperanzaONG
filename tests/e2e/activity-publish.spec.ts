import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";

import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Publishing an activity from the phone, steps 3 and 4 (step 7.3b, docs/07 §6.5, HU-06)
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

async function taxonomy() {
  const tag = randomUUID().slice(0, 6);
  const admin = adminClient();
  const { data: place } = await admin
    .from("places")
    .insert({ name: `[DEMO] Barrio ${tag}`, slug: `demo-barrio-${tag}`, kind: "neighborhood" })
    .select("id")
    .single();
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "activity", name: `[DEMO] Taller ${tag}`, slug: `demo-taller-${tag}` })
    .select("id")
    .single();
  return { placeId: place!.id, categoryId: category!.id };
}

function photo(n: number) {
  const colors = ["#6b8f5e", "#b79a4b", "#245745", "#173a2f", "#7a6224"];
  return sharp({
    create: { width: 1200, height: 900, channels: 3, background: colors[n % colors.length]! },
  })
    .jpeg()
    .toBuffer();
}

/** Step 1 with every basic field, then "Siguiente". Returns the activity id. */
async function basics(page: Page, title: string, placeId: string, categoryId: string) {
  await page.goto("/admin/actividades/nueva");
  await page.getByRole("textbox", { name: "Título", exact: true }).fill(title);
  await page.getByLabel("Fecha").fill("2026-09-20");
  await page.getByLabel("Hora de inicio").fill("09:00");
  await page.getByLabel("Lugar general").selectOption(placeId);
  await page.getByLabel("Categoría").selectOption(categoryId);
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/editar\?paso=2$/);
  return page.url().match(/actividades\/([0-9a-f-]+)\//)![1]!;
}

const peopleOf = (page: Page, n: number) =>
  page.getByRole("group", { name: new RegExp(`^Foto ${n}(?![0-9]).*aparecen personas`) });

test("an editor publishes an activity with 10 photos once the minor's authorization is in", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const editor = await createTestUser("editor");
  const { placeId, categoryId } = await taxonomy();
  await signInEnrollingMfa(page, editor);

  const title = `[DEMO] Jornada comunitaria ${randomUUID().slice(0, 6)}`;
  const activityId = await basics(page, title, placeId, categoryId);

  // Step 2 · 10 photos, each one described
  await page.getByLabel(/Tomar o elegir fotos/).setInputFiles(
    await Promise.all(
      Array.from({ length: 10 }, async (_, i) => ({
        name: `foto-${i + 1}.jpg`,
        mimeType: "image/jpeg",
        buffer: await photo(i),
      })),
    ),
  );
  const photos = page.getByRole("list", { name: "Fotos de la actividad" });
  await expect(photos.getByRole("listitem")).toHaveCount(10, { timeout: 90_000 });
  for (let n = 1; n <= 10; n += 1) {
    const description = page.getByLabel(`Descripción de la foto ${n}`, { exact: true });
    await description.fill(`[DEMO] Foto ${n}`);
    await description.blur();
    await expect(page.getByText("Descripción guardada.").first()).toBeVisible();
  }
  await page.getByRole("link", { name: "Siguiente" }).click();

  // Step 3 · nine photos without people, one with minors
  await expect(page).toHaveURL(/paso=3$/);
  for (let n = 1; n <= 9; n += 1) {
    await peopleOf(page, n).getByRole("radio", { name: "No", exact: true }).check();
    await expect(peopleOf(page, n).getByRole("radio", { name: "No", exact: true })).toBeChecked();
  }
  await peopleOf(page, 10).getByRole("radio", { name: "Sí, con menores" }).check();
  const tenth = page
    .getByRole("list", { name: "Personas en las fotos" })
    .getByRole("listitem")
    .nth(9);
  await expect(tenth).toContainText("Falta la autorización del representante legal.");
  expect(await axe(page)).toEqual([]);

  // Cannot continue without confirming that everyone is covered
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Confirma que todas" })).toBeVisible();
  await page.getByLabel(/Confirmo que todas las personas/).check();
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Step 4 · publishing is blocked, and says which photo and what to do
  await expect(page).toHaveURL(/paso=4$/);
  const review = page.getByRole("list", { name: "Revisión de la actividad" });
  await expect(review).toContainText(
    "Foto 10 («[DEMO] Foto 10»): hay menores y falta la autorización",
  );
  expect(await axe(page)).toEqual([]);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Antes de publicar resuelve" }),
  ).toBeVisible();

  // Resolver → step 3, register the guardian's authorization right there
  await review.getByRole("link", { name: "Resolver" }).first().click();
  await expect(page).toHaveURL(/paso=3$/);
  await tenth.getByRole("button", { name: /Vincular autorización/ }).click();
  const sheet = page.getByRole("dialog", { name: /Autorizaciones · Foto 10/ });
  await sheet.getByRole("button", { name: "Registrar una nueva" }).click();
  const child = `[DEMO] Niña ${randomUUID().slice(0, 6)}`;
  await sheet.getByLabel("Persona que aparece en las fotos").fill(child);
  await sheet.getByLabel("Es menor de edad").check();
  await sheet.getByRole("radio", { name: "Está de acuerdo en aparecer" }).check();
  await sheet.getByLabel("Nombre del representante legal").fill("[DEMO] Madre");
  await sheet.getByLabel("Qué cubre").fill("[DEMO] Fotos de la jornada comunitaria");
  await sheet.getByLabel("Fecha de firma").fill("2026-09-20");
  await sheet.getByLabel("Versión del formato").fill("v1");
  await sheet.getByLabel("Foto del formato firmado").setInputFiles({
    name: "formato.jpg",
    mimeType: "image/jpeg",
    buffer: await photo(0),
  });
  await sheet.getByRole("button", { name: "Registrar autorización" }).click();
  await expect(sheet.getByRole("list", { name: "Autorizaciones vinculadas" })).toContainText(
    child,
    { timeout: 20_000 },
  );
  await sheet.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(tenth).toContainText("Autorización al día.");

  await page.getByLabel(/Confirmo que todas las personas/).check();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(review.getByRole("link", { name: "Resolver" })).toHaveCount(0);
  await page.getByRole("button", { name: "Publicar ahora" }).click();

  await expect(page).toHaveURL(new RegExp(`/admin/actividades/${activityId}/listo`));
  await expect(page.getByRole("heading", { name: "¡Actividad publicada!" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Registrar otra actividad" })).toBeVisible();

  const admin = adminClient();
  const { data: activity } = await admin
    .from("activities")
    .select("status, published_at, activity_media(media_id)")
    .eq("id", activityId)
    .single();
  expect(activity!.status).toBe("published");
  expect(activity!.activity_media).toHaveLength(10);
  const { data: consent } = await admin
    .from("consent_records")
    .select("activity_id, created_by, media_consents(media_id)")
    .eq("subject_name", child)
    .single();
  expect(consent).toMatchObject({ activity_id: activityId, created_by: editor.id });
  expect(consent!.media_consents).toHaveLength(1);
});

test("an author sends to review with warnings and cannot publish", async ({ page }) => {
  const author = await createTestUser("author");
  const { placeId, categoryId } = await taxonomy();
  await signInEnrollingMfa(page, author);

  const activityId = await basics(
    page,
    `[DEMO] Taller ${randomUUID().slice(0, 6)}`,
    placeId,
    categoryId,
  );
  await page.getByLabel(/Tomar o elegir fotos/).setInputFiles({
    name: "a.jpg",
    mimeType: "image/jpeg",
    buffer: await photo(1),
  });
  await expect(
    page.getByRole("list", { name: "Fotos de la actividad" }).getByRole("listitem"),
  ).toHaveCount(1, { timeout: 30_000 });
  await page.goto(`/admin/actividades/${activityId}/editar?paso=3`);
  await peopleOf(page, 1).getByRole("radio", { name: "Sí, adultos" }).check();
  await expect(page.getByText("Un Editor o Administrador la vinculará")).toBeVisible();
  await expect(page.getByRole("button", { name: /Vincular autorización/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/paso=4$/);
  await expect(page.getByRole("button", { name: "Publicar ahora" })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Revisión de la actividad" })).toContainText(
    "falta la descripción",
  );
  await page.getByRole("button", { name: "Enviar a revisión" }).click();

  await expect(page.getByRole("heading", { name: "¡Enviada a revisión!" })).toBeVisible();
  const { data } = await adminClient()
    .from("activities")
    .select("status")
    .eq("id", activityId)
    .single();
  expect(data!.status).toBe("review");
});

test("an editor schedules an activity for a future date", async ({ page }) => {
  const editor = await createTestUser("editor");
  const { placeId, categoryId } = await taxonomy();
  await signInEnrollingMfa(page, editor);

  const activityId = await basics(
    page,
    `[DEMO] Programada ${randomUUID().slice(0, 6)}`,
    placeId,
    categoryId,
  );
  await page.goto(`/admin/actividades/${activityId}/editar?paso=4`);
  await page.getByRole("button", { name: "Programar" }).click();
  const tomorrow = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Publicar el (fecha)").fill(tomorrow);
  await page.getByLabel("A las (hora de Colombia)").fill("08:00");
  await page.getByRole("button", { name: "Programar publicación" }).click();

  await expect(page.getByRole("heading", { name: "¡Actividad programada!" })).toBeVisible();
  const { data } = await adminClient()
    .from("activities")
    .select("status, published_at")
    .eq("id", activityId)
    .single();
  expect(data!.status).toBe("published");
  expect(new Date(data!.published_at!).getTime()).toBeGreaterThan(Date.now());
});
