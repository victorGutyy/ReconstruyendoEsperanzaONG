import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { goToSection } from "./helpers/panel";
import { sessionSwitcher } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Site settings (step 8.1, HU-11): the Administrator changes WhatsApp and the
// networks from the panel, and the public site shows it without a deploy.
test.skip(!hasSupabase, "needs a local Supabase");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

async function axe(page: Page) {
  return (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations;
}

/** The settings row is shared: back to no WhatsApp and no networks. */
async function resetSettings() {
  const { error } = await adminClient()
    .from("site_settings")
    .update({ whatsapp_number: null, social_links: {}, contact_email: null, phone: null })
    .eq("id", true);
  expect(error).toBeNull();
}

test("the Administrator sets WhatsApp and a network, and the site shows them at once", async ({
  page,
}, testInfo) => {
  // One row for everyone: only one project changes it
  test.skip(testInfo.project.name === "mobile", "changes the shared settings row");
  test.setTimeout(120_000);
  await resetSettings();
  const admin = await createTestUser("admin");
  const editor = await createTestUser("editor");
  const people = sessionSwitcher();

  try {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveCount(0);

    await people.signIn(page, admin);
    await goToSection(page, "Configuración");
    await expect(page.getByRole("heading", { name: "Configuración", level: 1 })).toBeVisible();
    expect(await axe(page)).toEqual([]);

    // Each field says what is wrong
    await page.getByLabel("WhatsApp").fill("123");
    await page.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("WhatsApp:");
    await page.getByLabel("WhatsApp").fill("300 111 2233");
    await page.getByLabel("Facebook").fill("https://evil.example/demo");
    await page.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("Facebook:");

    await page.getByLabel("Facebook").fill("https://www.facebook.com/demo-reconstruyendo");
    await page.getByLabel("Correo").fill("contacto@example.test");
    await page.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(page.locator("form").getByRole("status")).toHaveText(
      "Configuración guardada. El sitio ya muestra los cambios.",
    );
    await page.reload();
    await expect(page.getByLabel("WhatsApp")).toHaveValue("300 111 2233");

    // The public site, without a deploy
    await page.goto("/");
    const whatsapp = page.getByRole("link", { name: /Escríbenos por WhatsApp/ });
    await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/573001112233\?text=/);
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: /Facebook/ })).toHaveAttribute(
      "href",
      "https://www.facebook.com/demo-reconstruyendo",
    );
    await expect(footer.getByRole("link", { name: "contacto@example.test" })).toBeVisible();
    expect(await axe(page)).toEqual([]);

    // An editor cannot change them
    await page.goto("/admin");
    await people.switchTo(page, editor);
    await page.goto("/admin/configuracion");
    await expect(
      page.getByText("Solo el Administrador cambia la configuración del sitio."),
    ).toBeVisible();
  } finally {
    await resetSettings();
  }
});
