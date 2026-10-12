import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { goToSection } from "./helpers/panel";
import { sessionSwitcher } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// The contact inbox (step 8.7b, HU-03): an editor reads, answers and handles
// messages; the Administrator restores one from the trash; an author never sees them.
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

async function messageRow(id: string) {
  const { data } = await adminClient()
    .from("contact_messages")
    .select("status, handled_by, deleted_at")
    .eq("id", id)
    .single();
  return data!;
}

test("an editor reads, answers and handles a message; the Administrator restores it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const editor = await createTestUser("editor");
  const admin = await createTestUser("admin");
  const tag = randomUUID().slice(0, 6);
  const name = `[DEMO] Vecina ${tag}`;
  // What the contact form stores after Turnstile and the rate limit
  const { data: message } = await adminClient()
    .from("contact_messages")
    .insert({
      full_name: name,
      email: `vecina-${tag}@example.test`,
      phone: "+573001112233",
      message: "[DEMO] Quiero ayudar en la huerta los sábados.",
      privacy_policy_version: "1.0",
      consent_accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  const people = sessionSwitcher();

  // The dashboard says there is something new
  await people.signIn(page, editor);
  await expect(page.getByRole("link", { name: /mensajes? sin leer/ })).toBeVisible();

  await goToSection(page, "Mensajes");
  await expect(page.getByRole("heading", { name: "Mensajes", level: 1 })).toBeVisible();
  const row = page.getByRole("list", { name: "Mensajes" }).getByRole("link", { name });
  await expect(row).toContainText("Nuevo");
  expect(await axe(page)).toEqual([]);

  // Opening it marks it as read; the reply links use what the person left
  await row.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect.poll(async () => (await messageRow(message!.id)).status).toBe("read");
  // The page refreshes itself once it is marked: review it after that
  await expect(page.getByText("Mensaje · Leído")).toBeVisible();
  await expect(page.getByRole("link", { name: `vecina-${tag}@example.test` })).toHaveAttribute(
    "href",
    /^mailto:vecina-.*\?subject=Respuesta%20de%20/,
  );
  await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
    "href",
    "https://wa.me/573001112233",
  );
  expect(await axe(page)).toEqual([]);

  // Handled: who and when are recorded
  await page.getByRole("button", { name: "Marcar como atendido" }).click();
  await expect(page.getByText(`Atendido por ${editor.fullName}`)).toBeVisible();
  expect(await messageRow(message!.id)).toMatchObject({ status: "handled", handled_by: editor.id });

  // To the trash
  await page.getByRole("button", { name: "Enviar a la papelera" }).click();
  await page
    .getByRole("dialog", { name: "Enviar a la papelera" })
    .getByRole("button", { name: "Sí, enviar a la papelera" })
    .click();
  await expect(page).toHaveURL(/\/admin\/mensajes$/);
  expect((await messageRow(message!.id)).deleted_at).not.toBeNull();

  // The Administrator finds it in the trash and restores it
  await people.switchTo(page, admin);
  await page.goto("/admin/papelera?tipo=message");
  await page.getByRole("button", { name: `Restaurar: ${name}` }).click();
  const restore = page.getByRole("dialog", { name: "Restaurar" });
  await expect(restore).toContainText("El mensaje vuelve a la bandeja.");
  await restore.getByRole("button", { name: "Restaurar" }).click();
  await expect(restore).toHaveCount(0);
  expect((await messageRow(message!.id)).deleted_at).toBeNull();
  await page.goto("/admin/mensajes?bandeja=handled");
  await expect(page.getByRole("list", { name: "Mensajes" })).toContainText(name);
});

test("an author never sees the messages", async ({ page }) => {
  const author = await createTestUser("author");
  await sessionSwitcher().signIn(page, author);
  await page.goto("/admin/mensajes");
  await expect(page.getByText("Tu rol no permite leer los mensajes.")).toBeVisible();
});
