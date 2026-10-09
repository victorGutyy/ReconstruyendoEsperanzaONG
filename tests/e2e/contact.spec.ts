import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Contact page (step 8.7). Whether the form is open depends on the published
// data policy, which pages.spec changes: the full flow is tested there.

test("the contact page is in the menu and never shows a marker", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("link", { name: "Contacto" }).first().click();
  await expect(page).toHaveURL(/\/contacto$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contacto");
  await expect(page.getByRole("heading", { name: "Otros medios" })).toBeVisible();
  await expect(page.getByText("[PENDIENTE")).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
