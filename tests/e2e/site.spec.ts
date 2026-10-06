import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// Public site frame (step 8.1): header, phone menu, skip link and the 404.
// Read-only: the settings spec changes the shared settings row.

async function axe(page: Page) {
  return (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations;
}

test("every public page has the masthead, a skip link and the footer", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Reconstruyendo Esperanza" }),
  ).toBeVisible();
  await expect(page.getByRole("banner")).toContainText("Calarcá, Quindío");
  await expect(page.getByRole("contentinfo")).toContainText("Hecho en Calarcá");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.locator("#contenido")).toBeFocused();
});

test("the phone menu opens full screen and closes", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone only");
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menú" }).click();
  const menu = page.getByRole("dialog", { name: "Menú" });
  await expect(menu.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  expect(await axe(page)).toEqual([]);
  await menu.getByRole("button", { name: "Cerrar menú" }).click();
  await expect(menu).toHaveCount(0);
});

test("an unknown address shows a friendly 404 inside the site", async ({ page }) => {
  const response = await page.goto("/esta-pagina-no-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("No encontramos esta página");
  await expect(page).toHaveTitle("Página no encontrada · Reconstruyendo Esperanza");
  await expect(page.getByRole("banner")).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await expect(page).toHaveURL(/\/$/);
});
