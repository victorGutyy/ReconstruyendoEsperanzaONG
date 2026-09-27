import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { goToSection, openPanelMenu } from "./helpers/panel";
import { signInEnrollingMfa } from "./helpers/session";
import { createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Audit viewer (RF-A-32, docs/05 §11): who changed what and when
test.skip(!hasSupabase, "needs a local Supabase with the secret key");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

test("an admin finds a role change in the audit log", async ({ page }) => {
  const admin = await createTestUser("admin");
  const member = await createTestUser("author");
  await signInEnrollingMfa(page, admin);

  await goToSection(page, "Usuarios");
  const row = page.getByRole("listitem").filter({ hasText: member.email });
  await row.getByLabel(`Rol de ${member.fullName}`).selectOption("editor");
  await row.getByRole("button", { name: "Cambiar rol" }).click();
  await expect(row).toContainText("Editor");

  await goToSection(page, "Auditoría");
  await expect(page.getByRole("heading", { name: "Auditoría", level: 1 })).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  // Other tests write to the same log in parallel: filter by this admin
  const filters = page.getByRole("form", { name: "Filtrar auditoría" });
  await filters.getByLabel("Persona").selectOption(admin.id);
  await filters.getByLabel("Acción").selectOption("role_change");
  await filters.getByRole("button", { name: "Filtrar" }).click();

  await expect(page).toHaveURL(/action=role_change/);
  await expect(page.getByRole("heading", { name: "1 registro" })).toBeVisible();
  const entry = page.getByRole("listitem").filter({ hasText: `Usuario: ${member.fullName}` });
  await expect(entry).toContainText("Cambió el rol");
  await expect(entry).toContainText(`Por ${admin.fullName}`);

  await entry.getByText("Ver cambios (1)").click();
  const change = entry.getByRole("definition");
  await expect(change).toContainText("Autor");
  await expect(change).toContainText("Editor");

  // The same person with another action has no entries
  await filters.getByLabel("Acción").selectOption("status_change");
  await filters.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByRole("heading", { name: "0 registros" })).toBeVisible();
  await expect(page.getByText("No hay registros con estos filtros.")).toBeVisible();

  // Hand-edited URLs are ignored, not an error
  await page.goto("/admin/auditoria?action=hack&page=abc&actor=x&from=ayer");
  await expect(page.getByRole("heading", { name: "Auditoría", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Acción")).toHaveValue("");
});

test("an author cannot read the audit log", async ({ page }) => {
  const author = await createTestUser("author");
  await signInEnrollingMfa(page, author);

  const menu = await openPanelMenu(page);
  await expect(menu.getByRole("link", { name: "Inicio" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Auditoría" })).toHaveCount(0);

  await page.goto("/admin/auditoria");
  await expect(page.getByRole("heading", { name: "No tienes permiso" })).toBeVisible();
  await expect(page.getByRole("list").filter({ hasText: "Cambió" })).toHaveCount(0);
});
