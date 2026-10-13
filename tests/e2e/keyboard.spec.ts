import { expect, type Page, test } from "@playwright/test";

import { failOnCspViolations } from "./helpers/csp";
import { signInEnrollingMfa } from "./helpers/session";
import { createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

failOnCspViolations();

// Keyboard use (step 9.6, docs/07 §8): the skip link comes first, every
// element the keyboard reaches shows where the focus is, and menus close with
// Escape giving the focus back. (The photo viewer: public-activities.spec.)

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

/**
 * Visible focus: an outline or a ring (Tailwind draws rings with box-shadow)
 * on the element, or a ring on the card that holds it (whole-card links mark
 * the card: has-[a:focus-visible]:ring-2).
 */
const focusIndicator = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return null;
    // Date and time fields: past their segments the focus moves to the
    // browser's own calendar button, which Chrome outlines itself (checked
    // on a screenshot); the page's styles cannot see it
    if (
      element instanceof HTMLInputElement &&
      ["date", "time"].includes(element.type) &&
      !element.matches(":focus-visible")
    ) {
      return null;
    }
    const style = getComputedStyle(element);
    const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const card = element.closest("article");
    const ring =
      style.boxShadow !== "none" || (card !== null && getComputedStyle(card).boxShadow !== "none");
    const name =
      element.getAttribute("aria-label") ||
      element.textContent?.trim().slice(0, 40) ||
      element.getAttribute("name") ||
      element.tagName.toLowerCase();
    return { name, visible: outline || ring };
  });

/** Tabs through the page and returns the elements whose focus cannot be seen. */
async function tabWithoutVisibleFocus(page: Page, stops: number): Promise<string[]> {
  const hidden: string[] = [];
  for (let stop = 0; stop < stops; stop++) {
    await page.keyboard.press("Tab");
    const focused = await focusIndicator(page);
    if (focused && !focused.visible) hidden.push(focused.name);
  }
  return hidden;
}

test("the skip link comes first and jumps to the content", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard: desktop");
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenido$/);
});

for (const url of ["/", "/actividades", "/contacto", "/quienes-somos"]) {
  test(`every stop on ${url} shows the focus`, async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard: desktop");
    await page.goto(url);
    expect(await tabWithoutVisibleFocus(page, 40)).toEqual([]);
  });
}

test("every stop of the panel shows the focus", async ({ page, isMobile }) => {
  test.skip(isMobile || !hasSupabase, "keyboard: desktop, needs a local Supabase");
  await signInEnrollingMfa(page, await createTestUser("admin"));
  for (const url of ["/admin", "/admin/actividades/nueva", "/admin/usuarios"]) {
    await page.goto(url);
    expect(await tabWithoutVisibleFocus(page, 30), url).toEqual([]);
  }
});

test("the phone menu closes with Escape and gives the focus back", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone only");
  await page.goto("/");
  const open = page.getByRole("button", { name: "Abrir menú" });
  await open.click();
  await expect(page.getByRole("dialog", { name: "Menú" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Menú" })).toHaveCount(0);
  await expect(open).toBeFocused();
});
