import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { goToSection, openPanelMenu } from "./helpers/panel";
import { signInEnrollingMfa } from "./helpers/session";
import { createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Panel frame (docs/07 §6.6): sidebar on desktop, bottom bar + sheet on phones
test.skip(!hasSupabase, "needs a local Supabase with the secret key");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

test("the menu shows the sections of the role and marks the current one", async ({
  page,
  isMobile,
}) => {
  const admin = await createTestUser("admin");
  await signInEnrollingMfa(page, admin);

  // Dashboard cards lead to the same sections
  const cards = page.getByRole("region", { name: "Secciones" });
  await expect(cards.getByRole("link")).toHaveCount(8);

  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  const menu = await openPanelMenu(page);
  await expect(menu.getByRole("link")).toHaveText([
    "Inicio",
    "Actividades",
    "Contenido",
    "Medios",
    "Autorizaciones",
    "Categorías y lugares",
    "Usuarios",
    "Auditoría",
    "Papelera",
  ]);
  await expect(menu.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByText(admin.fullName, { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Administrador", { exact: true }).filter({ visible: true }),
  ).toBeVisible();

  if (isMobile) {
    await expect(page.getByRole("dialog", { name: "Menú" })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar menú" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  await goToSection(page, "Auditoría");
  await expect(page).toHaveURL(/\/admin\/auditoria$/);
  // On phones the sheet closes after choosing a section
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const again = await openPanelMenu(page);
  await expect(again.getByRole("link", { name: "Auditoría" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("an author sees a panel with Inicio and Medios only", async ({ page }) => {
  const author = await createTestUser("author");
  await signInEnrollingMfa(page, author);

  await expect(page.getByRole("region", { name: "Secciones" }).getByRole("link")).toHaveText([
    /Actividades/,
    /Contenido/,
    /Medios/,
  ]);
  const menu = await openPanelMenu(page);
  await expect(menu.getByRole("link")).toHaveText(["Inicio", "Actividades", "Contenido", "Medios"]);
  await expect(page.getByText("Autor", { exact: true }).filter({ visible: true })).toBeVisible();
});
