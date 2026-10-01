import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { createTestPhoto } from "./helpers/media";
import { signOutFromPanel } from "./helpers/panel";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Editor actions on activities, tags and photos from the library (step 7.4b)
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

/** One activity written straight to the database, with a place and a category. */
async function seedActivity(
  title: string,
  status: "draft" | "review" | "published",
  createdBy: string,
) {
  const tag = randomUUID().slice(0, 6);
  const admin = adminClient();
  const { data: place } = await admin
    .from("places")
    .insert({ name: `[DEMO] Vereda ${tag}`, slug: `demo-vereda-${tag}`, kind: "vereda" })
    .select("id")
    .single();
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "activity", name: `[DEMO] Taller ${tag}`, slug: `demo-taller-${tag}` })
    .select("id")
    .single();
  const { data, error } = await admin
    .from("activities")
    .insert({
      title,
      slug: `demo-${tag}`,
      status,
      starts_at: "2026-09-20T14:00:00Z",
      published_at: status === "published" ? "2026-09-21T14:00:00Z" : null,
      created_by: createdBy,
      place_id: place!.id,
      category_id: category!.id,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id;
}

async function statusOf(id: string) {
  const { data } = await adminClient()
    .from("activities")
    .select("status, review_note")
    .eq("id", id)
    .single();
  return data!;
}

test("an editor returns an activity with a note and the author resubmits it", async ({ page }) => {
  const editor = await createTestUser("editor");
  const author = await createTestUser("author");
  const id = await seedActivity(`[DEMO] Jornada ${randomUUID().slice(0, 6)}`, "review", author.id);

  const editorPage = page;
  await signInEnrollingMfa(editorPage, editor);
  await editorPage.goto(`/admin/actividades/${id}/editar?paso=4`);

  await editorPage.getByRole("button", { name: "Devolver con nota" }).click();
  const dialog = editorPage.getByRole("dialog", { name: "Devolver a borrador" });
  await expect(dialog).toBeVisible();
  expect(await axe(editorPage)).toEqual([]);

  // The note is required
  await dialog.getByRole("button", { name: "Devolver a borrador" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Escribe qué hay que corregir.");
  await dialog.getByLabel("Qué hay que corregir").fill("Falta describir la foto de portada.");
  await dialog.getByRole("button", { name: "Devolver a borrador" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(editorPage.getByText("Actividad · Borrador")).toBeVisible();
  expect(await statusOf(id)).toEqual({
    status: "draft",
    review_note: "Falta describir la foto de portada.",
  });
  await signOutFromPanel(page);
  await expect(page).toHaveURL(/\/admin\/login$/);

  // The author sees the note above the wizard and sends it again
  const authorPage = page;
  await signInEnrollingMfa(authorPage, author);
  await authorPage.goto(`/admin/actividades/${id}/editar?paso=4`);
  const note = authorPage.getByRole("region", { name: /Nota de revisión/ });
  await expect(note).toContainText("Falta describir la foto de portada.");
  await expect(authorPage.getByRole("button", { name: "Devolver con nota" })).toHaveCount(0);

  await authorPage.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(authorPage).toHaveURL(/\/listo\?estado=review$/);
  expect(await statusOf(id)).toEqual({ status: "review", review_note: null });
});

test("an editor retires, archives and reopens a published activity", async ({ page }) => {
  const editor = await createTestUser("editor");
  const id = await seedActivity(
    `[DEMO] Publicada ${randomUUID().slice(0, 6)}`,
    "published",
    editor.id,
  );
  await signInEnrollingMfa(page, editor);
  await page.goto(`/admin/actividades/${id}/editar`);

  // Retire to fix it, with an optional note
  await page.getByRole("button", { name: "Retirar para corregir" }).click();
  const retire = page.getByRole("dialog", { name: "Retirar para corregir" });
  await retire.getByLabel("Nota (opcional)").fill("Corregir la hora.");
  await retire.getByRole("button", { name: "Retirar del sitio" }).click();
  await expect(page.getByText("Actividad · Borrador")).toBeVisible();
  await expect(page.getByRole("region", { name: /Nota de revisión/ })).toContainText(
    "Corregir la hora.",
  );

  // Publish it again from the database and archive it from the panel
  await adminClient().from("activities").update({ status: "published" }).eq("id", id);
  await page.reload();
  await page.getByRole("button", { name: "Archivar" }).click();
  await page
    .getByRole("dialog", { name: "Archivar la actividad" })
    .getByRole("button", { name: "Archivar" })
    .click();
  await expect(page.getByText("Actividad · Archivada")).toBeVisible();
  expect((await statusOf(id)).status).toBe("archived");

  await page.getByRole("button", { name: "Reabrir como borrador" }).click();
  await page
    .getByRole("dialog", { name: "Reabrir como borrador" })
    .getByRole("button", { name: "Reabrir" })
    .click();
  await expect(page.getByText("Actividad · Borrador")).toBeVisible();
});

test("an author tags an activity and adds photos from the library", async ({ page }) => {
  const author = await createTestUser("author");
  const suffix = randomUUID().slice(0, 6);
  const id = await seedActivity(`[DEMO] Con etiquetas ${suffix}`, "draft", author.id);
  const { data: tag } = await adminClient()
    .from("tags")
    .insert({ name: `[DEMO] Medio ambiente ${suffix}`, slug: `demo-medio-ambiente-${suffix}` })
    .select("id")
    .single();
  const alt = `[DEMO] Siembra en la vereda ${suffix}`;
  await createTestPhoto(author.id, { alt_text: alt, people_in_photo: "none" });

  await signInEnrollingMfa(page, author);

  // Step 1 · a tag is saved at once
  await page.goto(`/admin/actividades/${id}/editar?paso=1`);
  const tagBox = page.getByRole("checkbox", { name: `[DEMO] Medio ambiente ${suffix}` });
  await tagBox.check();
  await expect
    .poll(async () => {
      const { data } = await adminClient()
        .from("activity_tags")
        .select("tag_id")
        .eq("activity_id", id);
      return data?.map((row) => row.tag_id);
    })
    .toEqual([tag!.id]);
  await page.reload();
  await expect(tagBox).toBeChecked();

  // Step 2 · pick the photo from the library
  await page.goto(`/admin/actividades/${id}/editar?paso=2`);
  await page.getByRole("button", { name: "Elegir de la biblioteca" }).click();
  const picker = page.getByRole("dialog", { name: "Biblioteca de fotos" });
  await picker.getByLabel("Solo subidas por mí").check();
  await picker.getByRole("checkbox", { name: alt }).check();
  await expect(picker.getByText("1 foto elegida")).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await picker.getByRole("button", { name: "Agregar a la actividad" }).click();
  await expect(picker).toHaveCount(0);

  const photos = page.getByRole("list", { name: "Fotos de la actividad" });
  await expect(photos.getByRole("listitem")).toHaveCount(1);
  await expect(photos.getByText("Portada")).toBeVisible();

  // Already in the activity: not offered again
  await page.getByRole("button", { name: "Elegir de la biblioteca" }).click();
  await page.getByLabel("Solo subidas por mí").check();
  await expect(page.getByText("No hay más fotos para agregar.")).toBeVisible();
});
