import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

import { createTestConsent } from "./helpers/media";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Team profiles: published only with an adult's authorization, in a manual order (step 7.6d)
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

async function visibleToVisitors(id: string) {
  const visitor = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await visitor.from("team_members").select("id").eq("id", id);
  return (data ?? []).length === 1;
}

test("an editor adds a team profile, publishes it with an authorization and orders the team", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const tag = randomUUID().slice(0, 6);
  const editor = await createTestUser("editor");
  const name = `[DEMO] Ana Pérez ${tag}`;
  const consentId = await createTestConsent(editor.id, { subject_name: name });

  await signInEnrollingMfa(page, editor);
  await page.goto("/admin/contenido/equipo/nueva");
  await page.getByRole("textbox", { name: "Nombre", exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Cargo o rol" }).fill("[DEMO] Coordinadora");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/\/admin\/contenido\/equipo\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop()!;
  expect(await axe(page)).toEqual([]);

  // Without its authorization it cannot be published
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Falta vincular la autorización" }),
  ).toBeVisible();

  await page.getByRole("textbox", { name: "Buscar por nombre" }).fill(name);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("button", { name: `Elegir: ${name}` }).click();
  await expect(page.getByText(/Guardado a las/)).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByText("Equipo · Publicada")).toBeVisible();
  expect(await visibleToVisitors(id)).toBe(true);

  // Manual order: a profile added later moves up
  const second = `[DEMO] Luis Gómez ${tag}`;
  // Positions of our own, far from other tests running at the same time
  const base = 1_000_000 + Math.floor(Math.random() * 1_000_000) * 10;
  await adminClient().from("team_members").update({ position: base }).eq("id", id);
  await adminClient()
    .from("team_members")
    .insert({
      full_name: second,
      role_title: "[DEMO] Voluntario",
      position: base + 1,
      created_by: editor.id,
    });
  await page.goto("/admin/contenido/equipo");
  const team = page.getByRole("list", { name: "Equipo" });
  const names = async () =>
    (await team.getByRole("link").allTextContents()).filter((text) => text.includes(tag));
  expect(await names()).toEqual([name, second]);
  await page.getByRole("button", { name: `Subir: ${second}` }).click();
  await expect.poll(names).toEqual([second, name]);

  // Revoking the authorization hides the profile from visitors
  await adminClient()
    .from("consent_records")
    .update({ revoked_at: new Date().toISOString(), revocation_note: "[DEMO] Se retiró" })
    .eq("id", consentId);
  expect(await visibleToVisitors(id)).toBe(false);
  await page.reload();
  await expect(team.getByRole("listitem").filter({ hasText: name })).toContainText(
    "Autorización revocada o vencida",
  );
});
