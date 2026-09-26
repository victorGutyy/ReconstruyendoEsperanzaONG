import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Home", () => {
  test("loads in Spanish (Colombia) with the site title", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "es-CO");
    await expect(page).toHaveTitle("Reconstruyendo Esperanza · Calarcá");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reconstruyendo Esperanza");
  });

  test("has no automatically detectable WCAG 2.2 AA violations", async ({ page }) => {
    await page.goto("/");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
