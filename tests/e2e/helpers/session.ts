import { expect, type Page } from "@playwright/test";
import { generateSync } from "otplib";

import { signOutFromPanel } from "./panel";
import type { TestUser } from "./users";

/** 30-second window of the last code used per secret: never reuse one. */
const usedWindows = new Map<string, number>();
const currentWindow = () => Math.floor(Date.now() / 30_000);

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

  usedWindows.set(secret, currentWindow());
  await page.getByLabel("Código de 6 números").fill(generateSync({ secret }));
  await page.getByRole("button", { name: "Activar y entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  return secret;
}

/** Sign-in for a user who already enrolled MFA (`secret` from the first sign-in). */
export async function signInWithMfa(
  page: Page,
  user: Pick<TestUser, "email" | "password">,
  secret: string,
): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Verificación en dos pasos" })).toBeVisible();

  // A code already used in this window could be refused: wait for the next one
  if (usedWindows.get(secret) === currentWindow()) {
    await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 500);
  }
  usedWindows.set(secret, currentWindow());
  await page.getByLabel("Código de 6 números").fill(generateSync({ secret }));
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/**
 * Several people in one test: remembers each one's TOTP secret, so the first
 * sign-in enrolls MFA and the next ones only ask for the code.
 */
export function sessionSwitcher() {
  const secrets = new Map<string, string>();
  const signIn = async (page: Page, user: Pick<TestUser, "email" | "password">) => {
    const secret = secrets.get(user.email);
    if (secret) await signInWithMfa(page, user, secret);
    else secrets.set(user.email, await signInEnrollingMfa(page, user));
  };
  return {
    signIn,
    async switchTo(page: Page, user: Pick<TestUser, "email" | "password">) {
      await signOutFromPanel(page);
      await expect(page).toHaveURL(/\/admin\/login$/);
      await signIn(page, user);
    },
  };
}
