import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

import { createTestConsent } from "./helpers/media";
import { goToSection } from "./helpers/panel";
import { signInEnrollingMfa } from "./helpers/session";
import { createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Testimonials: always behind an adult's authorization, hidden as soon as it
// is revoked; only people who manage authorizations handle them (step 7.6d)
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

/** What a visitor of the site can read (anonymous, publishable key). */
async function visibleToVisitors(id: string) {
  const visitor = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await visitor.from("testimonials").select("id").eq("id", id);
  return (data ?? []).length === 1;
}

test("an editor publishes a testimonial that disappears when its authorization is revoked", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const tag = randomUUID().slice(0, 6);
  const editor = await createTestUser("editor");
  const adult = `[DEMO] Rosa ${tag}`;
  const minor = `[DEMO] Niña ${tag}`;
  const consentId = await createTestConsent(editor.id, { subject_name: adult });
  await createTestConsent(editor.id, { subject_name: minor, is_minor: true });

  await signInEnrollingMfa(page, editor);
  await goToSection(page, "Contenido");
  await page
    .getByRole("navigation", { name: "Tipos de contenido" })
    .getByRole("link", { name: "Testimonios" })
    .click();
  await page.getByRole("link", { name: "Nuevo testimonio" }).click();

  // Without an authorization it cannot be saved
  await page.getByRole("textbox", { name: "Testimonio" }).fill("[DEMO] Aprendí a tejer y a sanar.");
  await page.getByRole("textbox", { name: "Nombre que se muestra" }).fill("Rosa");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Elige la autorización de la persona." }),
  ).toBeVisible();

  // Minors are not offered; the adult is
  const search = page.getByRole("textbox", { name: "Buscar por nombre" });
  await search.fill(minor);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByText(/No hay autorizaciones vigentes con ese nombre/)).toBeVisible();
  await search.fill(adult);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("button", { name: `Elegir: ${adult}` }).click();
  await expect(page.getByText(`Vinculada: ${adult}`)).toBeVisible();

  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/\/admin\/contenido\/testimonios\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop()!;
  expect(await axe(page)).toEqual([]);

  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByText("Testimonio · Publicado")).toBeVisible();
  expect(await visibleToVisitors(id)).toBe(true);

  // Revoking the authorization hides it from visitors at once
  await page.goto(`/admin/autorizaciones/${consentId}`);
  await page.getByRole("button", { name: "Revocar autorización" }).click();
  await page.getByLabel("Motivo (quién lo pidió y cuándo)").fill("[DEMO] Ella lo pidió");
  await page.getByRole("button", { name: "Sí, revocar" }).click();
  await expect(page.getByText("Revocada", { exact: true })).toBeVisible();
  expect(await visibleToVisitors(id)).toBe(false);

  // The panel says so: Pendientes, the list view and the testimonial
  await page.goto("/admin");
  await page
    .getByRole("region", { name: "Pendientes" })
    .getByRole("link", { name: /con autorización revocada o vencida/ })
    .click();
  await expect(page).toHaveURL(/withdrawn=1/);
  await page.getByRole("link", { name: "Rosa" }).first().click();
  await expect(page.getByRole("region", { name: /Autorización revocada/ })).toContainText(
    "ya no se muestra en el sitio",
  );
});

test("an author does not see testimonials", async ({ page }) => {
  const author = await createTestUser("author");
  await signInEnrollingMfa(page, author);

  await page.goto("/admin/contenido/historias");
  await expect(
    page.getByRole("navigation", { name: "Tipos de contenido" }).getByRole("link"),
  ).not.toContainText(["Testimonios"]);

  await page.goto("/admin/contenido/testimonios");
  await expect(
    page.getByText("Los testimonios los gestiona quien maneja las autorizaciones."),
  ).toBeVisible();
});
