import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { createTestPhoto } from "./helpers/media";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Media library: describe photos, people in them, trash (step 6.4)
test.skip(!hasSupabase, "needs a local Supabase with Storage");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

const pending = (page: Page) => page.getByRole("region", { name: "Para publicarla" });

async function save(page: Page) {
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Cambios guardados." })).toBeVisible();
}

test("an author prepares their photo until it is ready to publish", async ({ page }) => {
  const author = await createTestUser("author");
  const photoId = await createTestPhoto(author.id);
  await signInEnrollingMfa(page, author);

  // From the library, filtered to the author's photos
  await page.goto("/admin/medios?mine=1");
  const library = page.getByRole("list", { name: "Biblioteca de fotos" });
  await expect(library.getByRole("link", { name: /^Abrir:/ })).toHaveCount(1);
  await expect(library).toContainText("Falta descripción");
  await library.getByRole("link", { name: "Abrir: Foto sin descripción" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/medios/${photoId}$`));

  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  await expect(pending(page)).toContainText("Falta descripción");
  await expect(pending(page)).toContainText("Sin clasificar personas");

  // People in the photo: an authorization is now missing (the author cannot see them)
  const description = `[DEMO] Personas sembrando árboles ${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Descripción (obligatoria para publicar)").fill(description);
  await page.getByRole("radio", { name: "Sí, adultos" }).check();
  await save(page);
  await expect(pending(page)).toContainText("Falta autorización");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(description);

  // Nobody recognisable: ready
  await page.getByRole("radio", { name: "No", exact: true }).check();
  await save(page);
  await expect(pending(page)).toContainText("Lista para publicar");

  await page.goto("/admin/medios?mine=1&pending=1");
  await expect(page.getByText("No hay fotos con pendientes.")).toBeVisible();

  // Audited with the author as actor
  const { data: audit } = await adminClient()
    .from("audit_logs")
    .select("actor_id")
    .eq("table_name", "media")
    .eq("record_id", photoId)
    .eq("action", "update");
  expect(audit).toContainEqual({ actor_id: author.id });
});

test("only the uploader or an editor edits a photo; editors see the trash", async ({
  page,
  browser,
}) => {
  const owner = await createTestUser("author");
  const alt = `[DEMO] Taller ${randomUUID().slice(0, 6)}`;
  const photoId = await createTestPhoto(owner.id, { alt_text: alt, people_in_photo: "none" });

  // Another author: read only, and no trash filter
  const other = await createTestUser("author");
  await signInEnrollingMfa(page, other);
  await page.goto(`/admin/medios/${photoId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(alt);
  await expect(page.getByRole("button", { name: "Guardar" })).toHaveCount(0);
  await expect(page.getByText("Solo quien subió la foto")).toBeVisible();
  await page.goto("/admin/medios");
  await expect(page.getByRole("link", { name: "En la papelera" })).toHaveCount(0);

  // An editor edits it and sends it to the trash
  const editorContext = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": randomClientIp() },
  });
  const editorPage = await editorContext.newPage();
  const editor = await createTestUser("editor");
  await signInEnrollingMfa(editorPage, editor);
  await editorPage.goto(`/admin/medios/${photoId}`);
  await editorPage.getByLabel("Crédito (opcional)").fill("[DEMO] Equipo de comunicaciones");
  await save(editorPage);

  await editorPage.getByRole("button", { name: "Enviar a la papelera" }).click();
  await editorPage.getByRole("button", { name: "Sí, enviar" }).click();
  await expect(editorPage.getByText("Esta foto está en la papelera.")).toBeVisible();

  await editorPage.goto("/admin/medios");
  await editorPage.getByRole("link", { name: "En la papelera" }).click();
  await expect(editorPage.getByRole("heading", { name: /Papelera de fotos/ })).toBeVisible();
  await expect(editorPage.getByRole("link", { name: `Abrir: ${alt}` })).toBeVisible();
  await editorContext.close();
});

test("the audit log shows photo changes in Spanish", async ({ page }) => {
  const admin = await createTestUser("admin");
  const photoId = await createTestPhoto(admin.id);
  await signInEnrollingMfa(page, admin);

  const alt = `[DEMO] Jornada ${randomUUID().slice(0, 6)}`;
  await page.goto(`/admin/medios/${photoId}`);
  await page.getByLabel("Descripción (obligatoria para publicar)").fill(alt);
  await page.getByRole("radio", { name: "Sí, hay menores" }).check();
  await save(page);
  await expect(pending(page)).toContainText("Falta autorización del representante");

  await page.goto(`/admin/auditoria?section=media&actor=${admin.id}`);
  const entry = page.getByRole("listitem").filter({ hasText: `Foto: ${alt}` });
  await expect(entry).toContainText("Editó");
  await entry.getByText(/Ver cambios/).click();
  await expect(entry).toContainText("¿Personas?");
  await expect(entry).toContainText("Sí, hay menores");
  await expect(entry).not.toContainText(photoId);
});
