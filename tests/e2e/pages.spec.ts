import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { sessionSwitcher } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Institutional and legal pages: legal ones are the Administrator's, each
// published version is kept, pending text never goes out (step 7.6e)
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

const PENDING = "[PENDIENTE: texto revisado por el abogado]";

/** Back to a draft with pending text (the four pages are shared by every run). */
async function resetPage(key: string) {
  const { data, error } = await adminClient()
    .from("pages")
    .update({
      status: "draft",
      version: null,
      body_text: PENDING,
      body: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: PENDING }] }],
      },
    })
    .eq("key", key)
    .select("id, title")
    .single();
  expect(error).toBeNull();
  return data!;
}

test("the Administrator publishes a legal page with its version; an editor only reads it", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  // Each project works on its own legal page: they run at the same time
  const key = testInfo.project.name === "mobile" ? "privacy-notice" : "privacy-policy";
  const legalPage = await resetPage(key);
  const version = `1.${randomUUID().slice(0, 6)}`;
  const admin = await createTestUser("admin");
  const editor = await createTestUser("editor");
  const people = sessionSwitcher();

  await people.signIn(page, admin);
  await page.goto("/admin/contenido/paginas");
  await page.getByRole("link", { name: legalPage.title }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/contenido/paginas/${legalPage.id}$`));

  // Pending text and no version: it is not published
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "[PENDIENTE" })).toBeVisible();

  // The approved text and a version
  const body = page.getByRole("textbox", { name: "Texto" });
  await body.click();
  await page.keyboard.press("ControlOrMeta+a");
  await body.pressSequentially("[DEMO] Tratamos tus datos con cuidado.");
  await page.getByRole("textbox", { name: "Versión del documento" }).fill(version);
  await expect(page.getByText(/Guardado a las/)).toBeVisible({ timeout: 10_000 });
  expect(await axe(page)).toEqual([]);

  await page.reload();
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByText("Página legal · Publicada")).toBeVisible();
  await expect(page.getByRole("list", { name: "Versiones publicadas" })).toContainText(
    `Versión ${version}`,
  );

  // The exact text is kept with that version
  const { data: kept } = await adminClient()
    .from("page_versions")
    .select("body_text")
    .eq("page_id", legalPage.id)
    .eq("version", version)
    .single();
  expect(kept?.body_text).toBe("[DEMO] Tratamos tus datos con cuidado.");

  // An editor reads it but cannot change it
  await people.switchTo(page, editor);
  await page.goto(`/admin/contenido/paginas/${legalPage.id}`);
  await expect(
    page.getByText("Solo lectura: las páginas legales las edita el Administrador."),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Texto" })).toHaveCount(0);
  await expect(page.getByText("[DEMO] Tratamos tus datos con cuidado.")).toBeVisible();
});
