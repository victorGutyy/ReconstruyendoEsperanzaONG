import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { goToSection, openPanelMenu } from "./helpers/panel";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Places and categories (step 6.1, docs/06 §4)
test.skip(!hasSupabase, "needs a local Supabase with the secret key");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

// Tests share one database and run in parallel: unique names per test
const unique = () => randomUUID().slice(0, 8);

test("an editor manages places and categories, and the changes are audited", async ({ page }) => {
  const editor = await createTestUser("editor");
  await signInEnrollingMfa(page, editor);
  await goToSection(page, "Categorías y lugares");
  await expect(page.getByRole("heading", { name: "Categorías y lugares", level: 1 })).toBeVisible();

  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  // A place: add, edit (deactivate), send to the trash
  const placeName = `[DEMO] Vereda Ñ ${unique()}`;
  await page.getByLabel("Nombre del lugar").fill(placeName);
  await page.locator("#place-kind").selectOption("vereda");
  await page.getByRole("button", { name: "Agregar lugar" }).click();
  await expect(page.locator("#place-create-notice")).toHaveText(`Lugar «${placeName}» agregado.`);

  const places = page.getByRole("list", { name: "Lugares" });
  const place = places.getByRole("listitem").filter({ hasText: placeName });
  await expect(place).toContainText("Vereda");

  await place.getByText("Editar").click();
  await place.getByLabel("Activo (se ofrece al crear contenido)").uncheck();
  await place.getByRole("button", { name: "Guardar" }).click();
  await expect(place).toContainText("Inactivo");

  // The same name again is rejected (same slug)
  await page.getByLabel("Nombre del lugar").fill(placeName);
  await page.getByRole("button", { name: "Agregar lugar" }).click();
  await expect(page.locator("#place-create-error")).toContainText("Ya existe un lugar");

  await place.getByRole("button", { name: `Enviar a la papelera: ${placeName}` }).click();
  await place.getByRole("button", { name: "Sí, enviar" }).click();
  await expect(places.getByRole("listitem").filter({ hasText: placeName })).toHaveCount(0);

  // Two activity categories, then the second moves up
  const first = `[DEMO] Salud ${unique()}`;
  const second = `[DEMO] Cultura ${unique()}`;
  const activities = page.getByRole("region", { name: /Categorías de actividades/ });
  for (const name of [first, second]) {
    await activities.getByLabel("Nombre de la categoría").fill(name);
    await activities.getByRole("button", { name: "Agregar categoría" }).click();
    await expect(activities.getByRole("status")).toContainText(`Categoría «${name}» agregada.`);
  }

  const order = activities.getByRole("list", { name: "Categorías de actividades" });
  const names = async () =>
    (await order.getByRole("listitem").allTextContents()).filter(
      (text) => text.includes(first) || text.includes(second),
    );
  await expect
    .poll(names)
    .toEqual([expect.stringContaining(first), expect.stringContaining(second)]);
  await activities.getByRole("button", { name: `Subir ${second}` }).click();
  await expect
    .poll(names)
    .toEqual([expect.stringContaining(second), expect.stringContaining(first)]);

  // The audit log names the editor for each change of the place
  const { data: placeRow } = await adminClient()
    .from("places")
    .select("id")
    .eq("name", placeName)
    .single();
  const { data: entries } = await adminClient()
    .from("audit_logs")
    .select("action, actor_id")
    .eq("table_name", "places")
    .eq("record_id", placeRow!.id)
    .order("id");
  expect(entries).toEqual([
    { action: "insert", actor_id: editor.id },
    { action: "status_change", actor_id: editor.id },
    { action: "soft_delete", actor_id: editor.id },
  ]);
});

test("an author cannot manage the taxonomy", async ({ page }) => {
  const author = await createTestUser("author");
  await signInEnrollingMfa(page, author);

  const menu = await openPanelMenu(page);
  await expect(menu.getByRole("link", { name: "Categorías y lugares" })).toHaveCount(0);

  await page.goto("/admin/categorias-y-lugares");
  await expect(page.getByRole("heading", { name: "No tienes permiso" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar lugar" })).toHaveCount(0);
});
