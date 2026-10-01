import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { createTestPhoto } from "./helpers/media";
import { goToSection } from "./helpers/panel";
import { sessionSwitcher, signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Stories on the shared content engine (step 7.6a)
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

async function storyOf(id: string) {
  const { data } = await adminClient()
    .from("posts")
    .select("status, review_note, cover_media_id")
    .eq("id", id)
    .single();
  return data!;
}

async function publicKeyOf(mediaId: string) {
  const { data } = await adminClient()
    .from("media")
    .select("public_key")
    .eq("id", mediaId)
    .single();
  return (data?.public_key as string | null) ?? null;
}

test("an author writes a story, an editor returns it, then publishes and retires it", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const tag = randomUUID().slice(0, 6);
  const author = await createTestUser("author");
  const editor = await createTestUser("editor");
  const { data: category } = await adminClient()
    .from("categories")
    .insert({ scope: "post", name: `[DEMO] Voces ${tag}`, slug: `demo-voces-${tag}` })
    .select("id")
    .single();
  const alt = `[DEMO] Manos en la tierra ${tag}`;
  const mediaId = await createTestPhoto(author.id, { alt_text: alt, people_in_photo: "none" });
  const title = `[DEMO] La huerta del barrio ${tag}`;

  // The author writes the draft
  const people = sessionSwitcher();
  await people.signIn(page, author);
  await goToSection(page, "Contenido");
  await expect(page).toHaveURL(/\/admin\/contenido\/historias$/);
  await page.getByRole("link", { name: "Nueva historia" }).click();
  await page.getByRole("textbox", { name: "Título", exact: true }).fill(title);
  await page.getByRole("textbox", { name: "Extracto" }).fill("[DEMO] Vecinas siembran juntas.");
  await page.getByLabel("Categoría").selectOption(category!.id);
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/\/admin\/contenido\/historias\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop()!;

  // Later changes save themselves
  await page.getByRole("textbox", { name: "Firma (opcional)" }).fill("[DEMO] Equipo del barrio");
  await expect(page.getByText(/Guardado a las/)).toBeVisible({ timeout: 10_000 });

  // Cover from the library
  await page.getByRole("button", { name: "Elegir portada" }).click();
  const picker = page.getByRole("dialog", { name: "Biblioteca de fotos" });
  await picker.getByLabel("Solo subidas por mí").check();
  await picker.getByRole("checkbox", { name: alt }).check();
  await picker.getByRole("button", { name: "Usar como portada" }).click();
  await expect(picker).toHaveCount(0);
  const cover = page.getByRole("region", { name: "Portada" });
  await expect(cover).toContainText(alt);
  expect(await axe(page)).toEqual([]);

  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.getByText("Enviada a revisión. Un Editor la revisará.")).toBeVisible();
  expect((await storyOf(id)).status).toBe("review");

  // The editor finds it in Pendientes and returns it with a note
  await people.switchTo(page, editor);
  await page
    .getByRole("region", { name: "Pendientes" })
    .getByRole("link", { name: /historias? por revisar/ })
    .click();
  await expect(page).toHaveURL(/historias\?status=review$/);
  await page.getByRole("link", { name: title }).click();
  await page.getByRole("button", { name: "Devolver con nota" }).click();
  const dialog = page.getByRole("dialog", { name: "Devolver a borrador" });
  await dialog.getByLabel("Qué hay que corregir").fill("Cuenta cuántas familias participaron.");
  await dialog.getByRole("button", { name: "Devolver a borrador" }).click();
  await expect(page.getByText("Historia · Borrador")).toBeVisible();

  // The author reads the note and sends it again
  await people.switchTo(page, author);
  await page.goto(`/admin/contenido/historias/${id}`);
  await expect(page.getByRole("region", { name: /Nota de revisión/ })).toContainText(
    "Cuenta cuántas familias participaron.",
  );
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.getByText("Enviada a revisión. Un Editor la revisará.")).toBeVisible();
  expect(await storyOf(id)).toMatchObject({ status: "review", review_note: null });

  // The editor publishes it: the cover goes to the site
  await people.switchTo(page, editor);
  await page.goto(`/admin/contenido/historias/${id}`);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByText("Historia · Publicada")).toBeVisible();
  expect(await publicKeyOf(mediaId)).not.toBeNull();

  // Retiring it takes the cover off the site
  await page.getByRole("button", { name: "Retirar para corregir" }).click();
  await page
    .getByRole("dialog", { name: "Retirar para corregir" })
    .getByRole("button", { name: "Retirar del sitio" })
    .click();
  await expect(page.getByText("Historia · Borrador")).toBeVisible();
  expect(await publicKeyOf(mediaId)).toBeNull();
});

test("an author cannot publish a story or act as an editor", async ({ page }) => {
  const author = await createTestUser("author");
  const { data } = await adminClient()
    .from("posts")
    .insert({
      title: `[DEMO] Mía ${randomUUID().slice(0, 6)}`,
      slug: `demo-mia-${randomUUID().slice(0, 8)}`,
      created_by: author.id,
    })
    .select("id")
    .single();

  await signInEnrollingMfa(page, author);
  await page.goto(`/admin/contenido/historias/${data!.id}`);
  await expect(page.getByRole("button", { name: "Publicar ahora" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Acciones del editor" })).toHaveCount(0);

  // Missing excerpt and category: it explains instead of sending
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Falta el extracto" })).toBeVisible();
});
