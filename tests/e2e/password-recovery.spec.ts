import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { countEmails, extractRecoveryLink, waitForEmail } from "./helpers/mailpit";
import { createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Password recovery with a token_hash link (docs/05 §4)
test.skip(!hasSupabase, "needs a local Supabase with Mailpit");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

const NOTICE = /Si el correo pertenece a una cuenta del panel, te enviamos un enlace/;

async function requestLink(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
  await expect(page).toHaveURL(/\/admin\/recuperar$/);
  await page.getByLabel("Correo de tu cuenta").fill(email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.locator("#recovery-notice")).toHaveText(NOTICE);
}

test("a user recovers access with the e-mail link and signs in with the new password", async ({
  page,
}) => {
  const user = await createTestUser("editor");
  await requestLink(page, user.email);

  const email = await waitForEmail(user.email);
  expect(email.Subject).toBe("Restablece tu contraseña · Reconstruyendo Esperanza");
  const link = extractRecoveryLink(email.HTML);

  await page.goto(link);
  await expect(page).toHaveURL(/\/admin\/restablecer$/);
  await expect(page.getByRole("heading", { name: "Crea tu contraseña nueva" })).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  // Validation: too short, then not matching
  await page.getByLabel("Contraseña nueva").fill("corta");
  await page.getByLabel("Repite la contraseña").fill("corta");
  await page.getByRole("button", { name: "Guardar y continuar" }).click();
  await expect(page.locator("#password-error")).toHaveText("Usa al menos 12 caracteres.");

  const newPassword = `nueva frase ${randomUUID()}`;
  await page.getByLabel("Contraseña nueva").fill(newPassword);
  await page.getByLabel("Repite la contraseña").fill(`${newPassword}x`);
  await page.getByRole("button", { name: "Guardar y continuar" }).click();
  await expect(page.locator("#password-error")).toHaveText("Las dos contraseñas no coinciden.");

  await page.getByLabel("Contraseña nueva").fill(newPassword);
  await page.getByLabel("Repite la contraseña").fill(newPassword);
  await page.getByRole("button", { name: "Guardar y continuar" }).click();

  // MFA is still mandatory after a password reset
  await expect(page).toHaveURL(/\/admin\/mfa$/);

  // The link works only once (someone reusing an old e-mail, without a session)
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/\/admin\/recuperar\?enlace=invalido$/);
  await expect(page.getByText("El enlace venció o ya se usó. Pide uno nuevo.")).toBeVisible();

  // The new password works; the old one does not
  await page.context().clearCookies();
  await page.goto("/admin/login");
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("#login-error")).toHaveText("Correo o contraseña incorrectos.");

  await page.getByLabel("Contraseña").fill(newPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/mfa$/);
});

test("an unknown e-mail gets the same answer and no e-mail is sent", async ({ page }) => {
  const unknown = `nobody-${randomUUID()}@example.test`;
  await requestLink(page, unknown);

  await page.waitForTimeout(1500);
  expect(await countEmails(unknown)).toBe(0);
});

test("a tampered link is rejected", async ({ page }) => {
  await page.goto("/admin/auth/confirm?token_hash=not-a-real-token&type=recovery");
  await expect(page).toHaveURL(/\/admin\/recuperar\?enlace=invalido$/);
});

test("the new password page requires the link's session", async ({ page }) => {
  await page.goto("/admin/restablecer");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Frestablecer$/);
});
