import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { generateSync } from "otplib";

import { signOutFromPanel } from "./helpers/panel";
import {
  createTestUser,
  deactivate,
  hasSupabase,
  type TestUser,
  randomClientIp,
} from "./helpers/users";

// Sign-in with mandatory MFA against a real Supabase Auth (HU-04, docs/05 §4)
test.skip(!hasSupabase, "needs a local Supabase with the secret key");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

async function signIn(page: Page, user: Pick<TestUser, "email" | "password">) {
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  // Wait for the Server Action's answer before the next step (it also resets the form)
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
  // React re-enables the button in the same update that resets the fields
  await expect(page.locator('button[type="submit"]').first()).toBeEnabled();
}

/** The form's own error message (Next.js also renders an empty role="alert" route announcer). */
function formError(page: Page) {
  return page.locator("#login-error, #mfa-error");
}

/** A code for the next 30-second window, so it never repeats the one already used. */
function nextCode(secret: string) {
  return generateSync({ secret, epoch: Math.floor(Date.now() / 1000) + 30 });
}

test("first sign-in enrolls the authenticator app and reaches the panel", async ({ page }) => {
  const user = await createTestUser("admin");

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
  await signIn(page, user);

  await expect(page).toHaveURL(/\/admin\/mfa/);
  await expect(page.getByRole("heading", { name: "Protege tu cuenta" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Código QR/ })).toBeVisible();

  await page.getByText("¿No puedes escanear? Escribe esta clave").click();
  const secret = (await page.getByTestId("mfa-secret").textContent())?.trim() ?? "";
  expect(secret).toMatch(/^[A-Z2-7]+=*$/);

  await page.getByLabel("Código de 6 números").fill(generateSync({ secret }));
  await page.getByRole("button", { name: "Activar y entrar" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: `Hola, ${user.fullName}` })).toBeVisible();

  // Sign out, then the next sign-in only asks for the code (no new QR)
  await signOutFromPanel(page);
  await expect(page).toHaveURL(/\/admin\/login$/);

  await signIn(page, user);
  await expect(page.getByRole("heading", { name: "Verificación en dos pasos" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Código QR/ })).toHaveCount(0);

  await page.getByLabel("Código de 6 números").fill(nextCode(secret));
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("a password-only session cannot open the panel", async ({ page }) => {
  const user = await createTestUser("admin");

  await page.goto("/admin/login");
  await signIn(page, user);
  await expect(page).toHaveURL(/\/admin\/mfa/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/mfa\?next=%2Fadmin$/);
});

test("a wrong MFA code is rejected", async ({ page }) => {
  const user = await createTestUser("admin");

  await page.goto("/admin/login");
  await signIn(page, user);
  await page.getByLabel("Código de 6 números").fill("000000");
  await page.getByRole("button", { name: "Activar y entrar" }).click();

  await expect(formError(page)).toContainText("Código incorrecto o vencido");
  await expect(page).toHaveURL(/\/admin\/mfa/);
});

test("a wrong password gives the same message as an unknown e-mail", async ({ page }) => {
  const user = await createTestUser("admin");

  await page.goto("/admin/login");
  await signIn(page, { email: user.email, password: "not-the-password" });
  await expect(formError(page)).toHaveText("Correo o contraseña incorrectos.");

  await signIn(page, { email: "nobody@example.test", password: "whatever" });
  await expect(formError(page)).toHaveText("Correo o contraseña incorrectos.");
});

test("repeated failed sign-ins are rate limited", async ({ page }) => {
  const user = await createTestUser("author");

  await page.goto("/admin/login");
  for (let attempt = 0; attempt < 5; attempt++) {
    await signIn(page, { email: user.email, password: `wrong-${attempt}` });
    await expect(formError(page)).toHaveText("Correo o contraseña incorrectos.");
  }

  // The sixth attempt is blocked even with the right password
  await signIn(page, user);
  await expect(formError(page)).toContainText("Demasiados intentos");
});

test("a deactivated user cannot sign in", async ({ page }) => {
  const user = await createTestUser("editor");
  await deactivate(user.id);

  await page.goto("/admin/login");
  await signIn(page, user);

  await expect(formError(page)).toContainText("Tu cuenta está desactivada");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("the sign-in screens have no detectable WCAG 2.2 AA violations", async ({ page }) => {
  const user = await createTestUser("admin");
  const axe = () =>
    new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

  await page.goto("/admin/login");
  expect((await axe()).violations).toEqual([]);

  await signIn(page, user);
  await expect(page.getByRole("heading", { name: "Protege tu cuenta" })).toBeVisible();
  expect((await axe()).violations).toEqual([]);
});

test("the e-mail is kept after a failed sign-in", async ({ page }) => {
  const user = await createTestUser("author");

  await page.goto("/admin/login");
  await signIn(page, { email: user.email, password: "not-the-password" });

  await expect(formError(page)).toHaveText("Correo o contraseña incorrectos.");
  await expect(page.getByLabel("Correo")).toHaveValue(user.email);
  await expect(page.getByLabel("Contraseña")).toHaveValue("");
});
