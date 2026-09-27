import type { Page } from "@playwright/test";

/**
 * The panel menu: the sidebar on desktop, or the "Más" sheet on phones (opened
 * here when needed). Every test runs on both projects (mobile and desktop).
 */
export async function openPanelMenu(page: Page) {
  const more = page.getByRole("button", { name: "Más", exact: true });
  if (await more.isVisible()) await more.click();
  return page.getByRole("navigation", { name: "Menú del panel" });
}

export async function goToSection(page: Page, name: string) {
  const menu = await openPanelMenu(page);
  await menu.getByRole("link", { name, exact: true }).click();
}

export async function signOutFromPanel(page: Page) {
  await openPanelMenu(page);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
}
