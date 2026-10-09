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
  test.setTimeout(240_000);
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

  // The contact form needs the published data policy (step 8.7): it is tested
  // here, where the policy has just been published, because the specs run in
  // parallel and only this one changes that page
  if (key !== "privacy-policy") return;
  await sendContactMessages(page, version);
});

/** HU-03: consent required, the accepted version is kept, 5 every 10 minutes. */
async function sendContactMessages(page: Page, version: string) {
  const tag = randomUUID().slice(0, 6);
  const token = page.locator('input[name="cf-turnstile-response"]');
  const openForm = async () => {
    await page.goto("/contacto");
    // Turnstile (Cloudflare's test keys locally and in CI) gives the form its token
    await expect(token).toHaveValue(/.+/, { timeout: 20_000 });
  };
  const fill = async (n: number) => {
    await page.getByLabel("Nombre", { exact: true }).fill(`[DEMO] Vecina ${tag}`);
    await page.getByLabel("Correo", { exact: true }).fill(`vecina-${tag}@example.test`);
    await page.getByLabel("Mensaje", { exact: true }).fill(`[DEMO] Mensaje ${n} ${tag}`);
  };
  const form = page.locator("form");

  await openForm();
  expect(await axe(page)).toEqual([]);
  await fill(1);
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(form.getByRole("alert")).toHaveText(
    "Para enviar el mensaje, acepta la política de datos.",
  );
  // What was typed is still there after the error
  await expect(page.getByLabel("Mensaje", { exact: true })).toHaveValue(`[DEMO] Mensaje 1 ${tag}`);
  await expect(token).toHaveValue(/.+/, { timeout: 20_000 });
  await page.getByRole("checkbox", { name: /Acepto la política/ }).check();
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.getByRole("status")).toContainText("Recibimos tu mensaje");

  const { data: saved } = await adminClient()
    .from("contact_messages")
    .select("email, privacy_policy_version, ip_hash, status")
    .eq("message", `[DEMO] Mensaje 1 ${tag}`)
    .single();
  expect(saved).toMatchObject({
    email: `vecina-${tag}@example.test`,
    privacy_policy_version: version,
    status: "new",
  });
  // The IP is never stored: only its HMAC
  expect(saved?.ip_hash).toMatch(/^[0-9a-f]{64}$/);

  // Two tries so far; three more pass and the sixth waits
  for (let n = 2; n <= 4; n += 1) {
    await openForm();
    await fill(n);
    await page.getByRole("checkbox", { name: /Acepto la política/ }).check();
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByRole("status")).toContainText("Recibimos tu mensaje");
  }
  await openForm();
  await fill(5);
  await page.getByRole("checkbox", { name: /Acepto la política/ }).check();
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(form.getByRole("alert")).toContainText("Espera unos minutos");
}
