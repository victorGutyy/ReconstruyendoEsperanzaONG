import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { extractRecoveryLink, waitForEmail } from "./helpers/mailpit";
import { goToSection } from "./helpers/panel";
import { completeMfaEnrollment, signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";
import { failOnCspViolations } from "./helpers/csp";

failOnCspViolations();

// User management: invitations, roles and deactivation (step 5.6, docs/05 §4)
test.skip(!hasSupabase, "needs a local Supabase with Mailpit");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

test("an admin invites a person who joins with a password and MFA", async ({ page, browser }) => {
  // axe reads the whole list, which grows with every user the suite creates
  test.setTimeout(90_000);
  const admin = await createTestUser("admin");
  await signInEnrollingMfa(page, admin);

  await goToSection(page, "Usuarios");
  await expect(page.getByRole("heading", { name: "Usuarios", level: 1 })).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  const email = `invited-${randomUUID()}@example.test`;
  await page.getByLabel("Nombre", { exact: true }).fill("[DEMO] Persona Invitada");
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Rol", { exact: true }).selectOption("editor");
  await page.getByRole("button", { name: "Enviar invitación" }).click();
  await expect(page.locator("#invite-notice")).toHaveText(`Invitación enviada a ${email}.`);

  const row = page.getByRole("listitem").filter({ hasText: email });
  await expect(row).toContainText("[DEMO] Persona Invitada");
  await expect(row).toContainText("Editor");
  await expect(row).toContainText(`invitada por ${admin.fullName}`);

  // The invited person opens the e-mail on "another device"
  const mail = await waitForEmail(email);
  expect(mail.Subject).toBe("Te invitaron al panel de Reconstruyendo Esperanza");

  const invitee = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": randomClientIp() },
  });
  const inviteePage = await invitee.newPage();
  await inviteePage.goto(extractRecoveryLink(mail.HTML));
  await expect(inviteePage).toHaveURL(/\/admin\/restablecer$/);

  const password = `frase de prueba ${randomUUID()}`;
  await inviteePage.getByLabel("Contraseña nueva").fill(password);
  await inviteePage.getByLabel("Repite la contraseña").fill(password);
  await inviteePage.getByRole("button", { name: "Guardar y continuar" }).click();

  await completeMfaEnrollment(inviteePage);
  await expect(
    inviteePage.getByRole("heading", { name: "Hola, [DEMO] Persona Invitada" }),
  ).toBeVisible();
  // An editor does not manage users
  await expect(inviteePage.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
  await invitee.close();
});

test("role changes and deactivation are applied and audited", async ({ page, browser }) => {
  const admin = await createTestUser("admin");
  const member = await createTestUser("author");
  await signInEnrollingMfa(page, admin);
  await page.goto("/admin/usuarios");

  const row = page.getByRole("listitem").filter({ hasText: member.email });
  await row.getByLabel(`Rol de ${member.fullName}`).selectOption("editor");
  await row.getByRole("button", { name: "Cambiar rol" }).click();
  await expect(row).toContainText("Editor");

  await row.getByRole("button", { name: "Desactivar" }).click();
  await expect(row).toContainText("Desactivada");
  await expect(row.getByRole("button", { name: "Reactivar" })).toBeVisible();

  // The audit log names the admin as the actor of both changes
  const { data: entries } = await adminClient()
    .from("audit_logs")
    .select("action, actor_id")
    .eq("record_id", member.id)
    .in("action", ["role_change", "status_change"]);
  expect(entries).toEqual(
    expect.arrayContaining([
      { action: "role_change", actor_id: admin.id },
      { action: "status_change", actor_id: admin.id },
    ]),
  );

  // The deactivated person can no longer sign in
  const other = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": randomClientIp() },
  });
  const otherPage = await other.newPage();
  await otherPage.goto("/admin/login");
  await otherPage.getByLabel("Correo").fill(member.email);
  await otherPage.getByLabel("Contraseña").fill(member.password);
  await otherPage.getByRole("button", { name: "Entrar" }).click();
  await expect(otherPage.locator("#login-error")).toBeVisible();
  await expect(otherPage).toHaveURL(/\/admin\/login/);
  await other.close();
});

test("an admin resets the MFA of someone who lost their phone, and it is audited", async ({
  page,
  browser,
}) => {
  const admin = await createTestUser("admin");
  const member = await createTestUser("editor");

  // The person had set up the authenticator app
  const memberContext = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": randomClientIp() },
  });
  await signInEnrollingMfa(await memberContext.newPage(), member);
  await memberContext.close();

  // Step 9.5b: the Administrator resets it, after confirming
  await signInEnrollingMfa(page, admin);
  await page.goto("/admin/usuarios");
  const row = page.getByRole("listitem").filter({ hasText: member.email });
  await row.getByRole("button", { name: `Restablecer verificación de ${member.fullName}` }).click();
  await row.getByRole("button", { name: "Cancelar" }).click();
  await row.getByRole("button", { name: `Restablecer verificación de ${member.fullName}` }).click();
  await row.getByRole("button", { name: "Sí, restablecer" }).click();
  await expect(row.getByRole("status")).toContainText("Verificación restablecida");

  const { data: entries } = await adminClient()
    .from("audit_logs")
    .select("actor_id, changed_fields, new_data")
    .eq("record_id", member.id)
    .contains("changed_fields", ["mfa"]);
  expect(entries).toEqual([
    {
      actor_id: admin.id,
      changed_fields: ["mfa"],
      new_data: { full_name: member.fullName, mfa: "restablecida" },
    },
  ]);

  // At the next sign-in the person sets up the app again
  const again = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": randomClientIp() },
  });
  await signInEnrollingMfa(await again.newPage(), member);
  await again.close();
});

test("an admin cannot change their own role or status", async ({ page }) => {
  const admin = await createTestUser("admin");
  await signInEnrollingMfa(page, admin);
  await page.goto("/admin/usuarios");

  const own = page.getByRole("listitem").filter({ hasText: admin.email });
  await expect(own).toContainText("(tú)");
  await expect(own.getByRole("button")).toHaveCount(0);
});

test("an author cannot manage users", async ({ page }) => {
  const author = await createTestUser("author");
  await signInEnrollingMfa(page, author);

  await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "No tienes permiso" })).toBeVisible();
});
