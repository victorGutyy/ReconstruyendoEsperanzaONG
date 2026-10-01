import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { createTestPhoto } from "./helpers/media";
import { sessionSwitcher } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Galleries on the shared content engine (step 7.6c)
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

async function publicKeyOf(mediaId: string) {
  const { data } = await adminClient()
    .from("media")
    .select("public_key")
    .eq("id", mediaId)
    .single();
  return (data?.public_key as string | null) ?? null;
}

const photos = (page: Page) => page.getByRole("list", { name: "Fotos de la galería" });

test("an author builds a gallery and an editor publishes it once every photo is ready", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const tag = randomUUID().slice(0, 6);
  const author = await createTestUser("author");
  const editor = await createTestUser("editor");
  const ready = `[DEMO] Manos sembrando ${tag}`;
  const pending = `[DEMO] Vecinas en la huerta ${tag}`;
  const readyId = await createTestPhoto(author.id, { alt_text: ready, people_in_photo: "none" });
  const pendingId = await createTestPhoto(author.id, {
    alt_text: pending,
    people_in_photo: "identifiable",
  });
  const activityTitle = `[DEMO] Jornada de siembra ${tag}`;
  await adminClient()
    .from("activities")
    .insert({
      title: activityTitle,
      slug: `demo-jornada-${tag}`,
      starts_at: "2026-09-20T14:00:00Z",
      created_by: author.id,
    });
  const title = `[DEMO] Galería de la siembra ${tag}`;
  const people = sessionSwitcher();

  // The author creates it for an activity and adds two photos
  await people.signIn(page, author);
  await page.goto("/admin/contenido/galerias/nueva");
  await page.getByRole("textbox", { name: "Título" }).fill(title);
  await page.getByLabel("Pertenece a (opcional)").selectOption({ label: activityTitle });
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/\/admin\/contenido\/galerias\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop()!;

  await page.getByRole("button", { name: "Agregar fotos de la biblioteca" }).click();
  const picker = page.getByRole("dialog", { name: "Biblioteca de fotos" });
  await picker.getByLabel("Solo subidas por mí").check();
  await picker.getByRole("checkbox", { name: ready }).check();
  await picker.getByRole("checkbox", { name: pending }).check();
  await expect(picker.getByText("2 fotos elegidas")).toBeVisible();
  await picker.getByRole("button", { name: "Agregar a la galería" }).click();
  await expect(photos(page).getByRole("listitem")).toHaveCount(2);
  await expect(photos(page).getByRole("listitem").first()).toContainText("Portada");

  // Caption and order
  await page.getByLabel("Pie de foto en esta galería (opcional)").first().fill("[DEMO] La primera");
  await page.getByLabel("Pie de foto en esta galería (opcional)").first().blur();
  await expect(page.getByText("Pie de foto guardado.")).toBeVisible();
  await page.getByRole("button", { name: /^Subir: Foto 2/ }).click();
  await expect(photos(page).getByRole("listitem").first()).toContainText(pending);
  expect(await axe(page)).toEqual([]);

  // A photo still needs an authorization: the author may send it anyway
  await expect(page.getByRole("list", { name: "Revisión de la galería" })).toContainText(
    "falta su autorización",
  );
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.getByText("Enviada a revisión. Un Editor la revisará.")).toBeVisible();

  // The editor cannot publish it until that photo is resolved or removed
  await people.switchTo(page, editor);
  await page.goto(`/admin/contenido/galerias/${id}`);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "falta su autorización" })).toBeVisible();
  await page.getByRole("button", { name: /^Quitar de la galería: Foto 1/ }).click();
  await expect(photos(page).getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByText("Galería · Publicada")).toBeVisible();

  expect(await publicKeyOf(readyId)).not.toBeNull();
  expect(await publicKeyOf(pendingId)).toBeNull();
  await expect(photos(page).getByText("En el sitio")).toBeVisible();
});
