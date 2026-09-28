import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { createTestConsent, createTestPhoto } from "./helpers/media";
import { signInEnrollingMfa } from "./helpers/session";
import { createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Linking image authorizations to photos (step 6.5b, HU-06)
test.skip(!hasSupabase, "needs a local Supabase with Storage");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

const pending = (page: Page) => page.getByRole("region", { name: "Para publicarla" });
const panel = (page: Page) => page.getByRole("region", { name: "Autorizaciones de esta foto" });

test("an editor links a guardian's authorization and the photo becomes publishable", async ({
  page,
}) => {
  const editor = await createTestUser("editor");
  const tag = randomUUID().slice(0, 6);
  const photoId = await createTestPhoto(editor.id, {
    alt_text: `[DEMO] Niños jugando ${tag}`,
    people_in_photo: "minors",
  });
  const child = `[DEMO] Niña ${tag}`;
  const consentId = await createTestConsent(editor.id, { subject_name: child, is_minor: true });
  // Not offered: revoked, or a minor who does not want to appear
  await createTestConsent(editor.id, {
    subject_name: `[DEMO] Niña revocada ${tag}`,
    is_minor: true,
    revoked_at: new Date().toISOString(),
  });
  await createTestConsent(editor.id, {
    subject_name: `[DEMO] Niño que no quiere ${tag}`,
    is_minor: true,
    minor_opinion: "disagrees",
  });

  await signInEnrollingMfa(page, editor);
  await page.goto(`/admin/medios/${photoId}`);
  await expect(pending(page)).toContainText("Falta autorización del representante");
  await expect(panel(page)).toContainText("No hay autorizaciones vinculadas.");
  await expect(panel(page)).toContainText("todas las personas reconocibles");

  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  await panel(page).getByLabel("Vincular una autorización").fill(tag);
  await panel(page).getByRole("button", { name: "Buscar" }).click();
  const found = panel(page).getByRole("list", { name: "Autorizaciones encontradas" });
  await expect(found.getByRole("listitem")).toHaveCount(1);
  await found.getByRole("button", { name: `Vincular: ${child}` }).click();

  await expect(pending(page)).toContainText("Lista para publicar");
  const linked = panel(page).getByRole("list", { name: "Autorizaciones vinculadas" });
  await expect(linked).toContainText(child);
  await expect(linked).toContainText("Vigente");

  // The authorization lists the photo it covers
  await page.goto(`/admin/autorizaciones/${consentId}`);
  await expect(page.getByRole("list", { name: "Fotos que cubre" })).toContainText(
    `[DEMO] Niños jugando ${tag}`,
  );

  // Unlinking brings the pending item back
  await page.goto(`/admin/medios/${photoId}`);
  await panel(page)
    .getByRole("button", { name: `Desvincular: ${child}` })
    .click();
  await expect(pending(page)).toContainText("Falta autorización del representante");
});

test("an author sees what is missing but not the names in the authorizations", async ({ page }) => {
  const author = await createTestUser("author");
  const photoId = await createTestPhoto(author.id, {
    alt_text: "[DEMO] Taller",
    people_in_photo: "identifiable",
  });
  await signInEnrollingMfa(page, author);
  await page.goto(`/admin/medios/${photoId}`);

  await expect(pending(page)).toContainText("Falta autorización");
  await expect(panel(page)).toHaveCount(0);
});

test("the audit log records links and authorizations without file paths", async ({ page }) => {
  const admin = await createTestUser("admin");
  const tag = randomUUID().slice(0, 6);
  const photoId = await createTestPhoto(admin.id, {
    alt_text: `[DEMO] Jornada ${tag}`,
    people_in_photo: "identifiable",
  });
  const adult = `[DEMO] Adulto ${tag}`;
  await createTestConsent(admin.id, { subject_name: adult });

  await signInEnrollingMfa(page, admin);
  await page.goto(`/admin/medios/${photoId}`);
  await panel(page).getByLabel("Vincular una autorización").fill(tag);
  await panel(page).getByRole("button", { name: "Buscar" }).click();
  await panel(page)
    .getByRole("button", { name: `Vincular: ${adult}` })
    .click();
  await expect(pending(page)).toContainText("Lista para publicar");

  await page.goto(`/admin/auditoria?section=media_consents&actor=${admin.id}`);
  await expect(
    page.getByRole("listitem").filter({ hasText: "Vínculo entre una foto y una autorización" }),
  ).toHaveCount(1);

  await page.goto("/admin/auditoria?section=consent_records");
  await expect(page.getByRole("main")).not.toContainText("demo-no-file.webp");
});
