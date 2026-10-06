import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { createTestPhoto } from "./helpers/media";
import { goToSection, openPanelMenu } from "./helpers/panel";
import { sessionSwitcher } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Trash (step 7.7): editors send content to it; the Administrator restores
// it or deletes it for good, never a photo that is still in use.
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

/** A published (or draft) activity written straight to the database. */
async function seedActivity(
  title: string,
  status: "draft" | "published",
  extra: { cover_media_id?: string } = {},
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
      place_id: place!.id,
      category_id: category!.id,
      ...extra,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id;
}

async function activityRow(id: string) {
  const { data } = await adminClient()
    .from("activities")
    .select("status, deleted_at")
    .eq("id", id)
    .maybeSingle();
  return data;
}

test("an editor sends published content to the trash; the Administrator restores it and deletes it for good", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const editor = await createTestUser("editor");
  const admin = await createTestUser("admin");
  const title = `[DEMO] Jornada ${randomUUID().slice(0, 6)}`;
  const id = await seedActivity(title, "published");
  const people = sessionSwitcher();

  // Editor: sends it to the trash, with a warning that it leaves the site
  await people.signIn(page, editor);
  await page.goto(`/admin/actividades/${id}/editar`);
  await page.getByRole("button", { name: "Enviar a la papelera" }).click();
  const dialog = page.getByRole("dialog", { name: "Enviar a la papelera" });
  await expect(dialog).toContainText("saldrá del sitio en este momento");
  expect(await axe(page)).toEqual([]);
  await dialog.getByRole("button", { name: "Sí, enviar a la papelera" }).click();
  await expect(page).toHaveURL(/\/admin\/actividades$/);
  expect((await activityRow(id))?.deleted_at).not.toBeNull();

  // The trash is the Administrator's
  const menu = await openPanelMenu(page);
  await expect(menu.getByRole("link", { name: "Papelera" })).toHaveCount(0);
  await page.goto("/admin/papelera");
  await expect(page.getByText("Solo el Administrador gestiona la papelera.")).toBeVisible();

  // Administrator: finds it, with who sent it, and restores it as a draft
  await people.switchTo(page, admin);
  await goToSection(page, "Papelera");
  await expect(page.getByRole("heading", { name: "Papelera", level: 1 })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Filtros de la papelera" })
    .getByRole("link", { name: "Actividades" })
    .click();
  await expect(page).toHaveURL(/\/admin\/papelera\?tipo=activity$/);
  const item = page.getByRole("listitem").filter({ hasText: title });
  await expect(item).toContainText(`por ${editor.fullName}`);
  expect(await axe(page)).toEqual([]);

  await page.getByRole("button", { name: `Restaurar: ${title}` }).click();
  const restore = page.getByRole("dialog", { name: "Restaurar" });
  await restore.getByRole("button", { name: "Restaurar" }).click();
  await expect(restore).toHaveCount(0);
  await expect(item).toHaveCount(0);
  expect(await activityRow(id)).toEqual({ status: "draft", deleted_at: null });

  // Back in the trash, deleted for good after typing the word
  await adminClient()
    .from("activities")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  await page.reload();
  await page.getByRole("button", { name: `Eliminar definitivamente: ${title}` }).click();
  const purge = page.getByRole("dialog", { name: "Eliminar definitivamente" });
  const confirm = purge.getByRole("button", { name: "Eliminar", exact: true });
  await expect(confirm).toBeDisabled();
  expect(await axe(page)).toEqual([]);
  await purge.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
  await confirm.click();
  await expect(purge).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: title })).toHaveCount(0);
  expect(await activityRow(id)).toBeNull();
});

test("a photo still in use is not deleted; once unused, it goes with its files", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const admin = await createTestUser("admin");
  const suffix = randomUUID().slice(0, 6);
  const alt = `[DEMO] Portada ${suffix}`;
  const photoId = await createTestPhoto(admin.id, { alt_text: alt, people_in_photo: "none" });
  const title = `[DEMO] Con portada ${suffix}`;
  const activityId = await seedActivity(title, "draft", { cover_media_id: photoId });
  const now = new Date().toISOString();
  await adminClient().from("media").update({ deleted_at: now }).eq("id", photoId);
  await adminClient().from("activities").update({ deleted_at: now }).eq("id", activityId);

  await sessionSwitcher().signIn(page, admin);
  await page.goto("/admin/papelera?tipo=media");
  await page.getByRole("button", { name: `Eliminar definitivamente: ${alt}` }).click();
  const purge = page.getByRole("dialog", { name: "Eliminar definitivamente" });
  await purge.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
  await purge.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(purge.getByRole("alert")).toHaveText(
    `La foto todavía se usa en: actividad «${title}» (en la papelera). Quítala de ahí antes de eliminarla.`,
  );
  await purge.getByRole("button", { name: "Cancelar" }).click();

  // Deleting the activity frees the photo
  await page.goto("/admin/papelera?tipo=activity");
  await page.getByRole("button", { name: `Eliminar definitivamente: ${title}` }).click();
  const purgeActivity = page.getByRole("dialog", { name: "Eliminar definitivamente" });
  await purgeActivity.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
  await purgeActivity.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(purgeActivity).toHaveCount(0);

  await page.goto("/admin/papelera?tipo=media");
  await page.getByRole("button", { name: `Eliminar definitivamente: ${alt}` }).click();
  const purgePhoto = page.getByRole("dialog", { name: "Eliminar definitivamente" });
  await purgePhoto.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
  await purgePhoto.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(purgePhoto).toHaveCount(0);

  const { data: row } = await adminClient()
    .from("media")
    .select("id")
    .eq("id", photoId)
    .maybeSingle();
  expect(row).toBeNull();
  const { data: files } = await adminClient().storage.from("media-private").list(photoId);
  expect(files ?? []).toEqual([]);
});
