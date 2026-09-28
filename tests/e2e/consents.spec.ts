import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";

import { openPanelMenu } from "./helpers/panel";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Image authorizations: register, view, correct, revoke (step 6.5a, docs/09 §4)
test.skip(!hasSupabase, "needs a local Supabase with Storage");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

/** Photo of a signed paper form, taken with a phone that records GPS. */
function formPhotoWithGps() {
  return sharp({ create: { width: 2400, height: 3200, channels: 3, background: "#f4f1ea" } })
    .jpeg()
    .withExif({
      IFD0: { Make: "DemoPhone" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "4/1 31/1 0/1" },
    })
    .toBuffer();
}

async function axe(page: Page) {
  return (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations;
}

test("an editor registers a minor's authorization, corrects it and revokes it", async ({
  page,
}) => {
  const editor = await createTestUser("editor");
  await signInEnrollingMfa(page, editor);

  const menu = await openPanelMenu(page);
  await menu.getByRole("link", { name: "Autorizaciones", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Autorizaciones", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Registrar autorización" }).click();
  expect(await axe(page)).toEqual([]);

  const subject = `[DEMO] Niña ${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Persona que aparece en las fotos").fill(subject);
  await page.getByLabel("Es menor de edad").check();

  // A minor always needs the child's opinion; saving without it is refused
  await page.getByLabel("Nombre del representante legal").fill("[DEMO] Madre");
  await page.getByLabel("Qué cubre").fill("Fotos de la jornada del 12/03/2026");
  await page.getByLabel("Fecha de firma").fill("2026-03-12");
  await page.getByLabel("Versión del formato").fill("v1");
  await page.getByLabel("Foto del formato firmado").setInputFiles({
    name: "formato.jpg",
    mimeType: "image/jpeg",
    buffer: await formPhotoWithGps(),
  });
  await page.getByRole("button", { name: "Registrar autorización" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Registra la opinión del menor" }),
  ).toBeVisible();

  await page.getByRole("radio", { name: "Está de acuerdo en aparecer" }).check();
  await page.getByRole("button", { name: "Registrar autorización" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(subject, { timeout: 20_000 });
  await expect(page.getByText("Vigente", { exact: true })).toBeVisible();
  await expect(page.getByText("Su representante legal: [DEMO] Madre")).toBeVisible();
  expect(await axe(page)).toEqual([]);

  // The stored form: WebP without EXIF/GPS, audited with the editor as actor
  const admin = adminClient();
  const { data: record } = await admin
    .from("consent_records")
    .select("id, document_path, created_by, minor_opinion")
    .eq("subject_name", subject)
    .single();
  expect(record).toMatchObject({ created_by: editor.id, minor_opinion: "agrees" });
  const { data: file } = await admin.storage
    .from("consent-documents")
    .download(record!.document_path);
  const stored = await sharp(Buffer.from(await file!.arrayBuffer())).metadata();
  expect(stored.format).toBe("webp");
  expect(stored.exif).toBeUndefined();

  // The link to the signed form redirects to a short-lived signed URL
  const response = await page.request.get(`/admin/autorizaciones/${record!.id}/formato`, {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toContain("/storage/v1/object/sign/consent-documents/");
  expect(response.headers()["cache-control"]).toBe("no-store");

  // Correct a field
  await page.getByLabel("Válida hasta (opcional)").fill("2030-12-31");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Cambios guardados." })).toBeVisible();

  // Revoke: a note is required, then it is final
  await page.getByRole("button", { name: "Revocar autorización" }).click();
  await page.getByLabel("Motivo (quién lo pidió y cuándo)").fill("[DEMO] La madre lo pidió");
  await page.getByRole("button", { name: "Sí, revocar" }).click();
  await expect(page.getByText("Revocada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Revocar autorización" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toHaveCount(0);

  // It appears among the revoked ones
  await page.goto(`/admin/autorizaciones?status=revoked&q=${encodeURIComponent(subject)}`);
  await expect(page.getByRole("list", { name: "Autorizaciones" })).toContainText(subject);
});

test("an author cannot see image authorizations", async ({ page }) => {
  const author = await createTestUser("author");
  await signInEnrollingMfa(page, author);

  const menu = await openPanelMenu(page);
  await expect(menu.getByRole("link", { name: "Autorizaciones" })).toHaveCount(0);

  await page.goto("/admin/autorizaciones");
  await expect(page.getByRole("heading", { name: "No tienes permiso" })).toBeVisible();

  const response = await page.request.get(`/admin/autorizaciones/${randomUUID()}/formato`, {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(403);
});
