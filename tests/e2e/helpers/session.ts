import { expect, type Page } from "@playwright/test";
import { generateSync } from "otplib";

import type { TestUser } from "./users";

/**
 * Full sign-in for a user that has never enrolled MFA: password, QR enrollment
 * (using the plain-text secret) and the first code. Returns the TOTP secret.
 */
export async function signInEnrollingMfa(
  page: Page,
  user: Pick<TestUser, "email" | "password">,
): Promise<string> {
  await page.goto("/admin/login");
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();

  return completeMfaEnrollment(page);
}

/** From the "Protege tu cuenta" screen to the panel home. Returns the TOTP secret. */
export async function completeMfaEnrollment(page: Page): Promise<string> {
  await expect(page.getByRole("heading", { name: "Protege tu cuenta" })).toBeVisible();
  await page.getByText("¿No puedes escanear? Escribe esta clave").click();
  const secret = (await page.getByTestId("mfa-secret").textContent())?.trim() ?? "";

  await page.getByLabel("Código de 6 números").fill(generateSync({ secret }));
  await page.getByRole("button", { name: "Activar y entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  return secret;
}
