import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { createTestConsent } from "./helpers/media";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Home, Quiénes somos, Apóyanos and the legal pages (step 8.5).
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

const PENDING = (what: string) => `[PENDIENTE: ${what}]`;
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

/** Back to how the migration created it: a draft waiting for its text. */
async function resetPage(key: "about" | "support", pending: string) {
  const { error } = await adminClient()
    .from("pages")
    .update({ status: "draft", body: doc(pending), body_text: pending })
    .eq("key", key);
  expect(error).toBeNull();
}

test("the home page, Quiénes somos and Apóyanos show what is published, never a marker", async ({
  page,
}, testInfo) => {
  // The fixed pages are one row each: only one project changes them
  test.skip(testInfo.project.name === "mobile", "changes the shared fixed pages");
  test.setTimeout(120_000);
  const editor = await createTestUser("editor");
  const tag = randomUUID().slice(0, 6);
  const admin = adminClient();

  try {
    // Quiénes somos: published text, a team profile and a testimonial
    const aboutText = `[DEMO] Somos vecinos de Calarcá ${tag}.`;
    const memberName = `[DEMO] Ana Ruiz ${tag}`;
    await admin.from("team_members").insert({
      full_name: memberName,
      role_title: "[DEMO] Coordinadora",
      bio: "[DEMO] Lleva diez años en la vereda.",
      position: -1000,
      status: "published",
      published_at: new Date(Date.now() - 60_000).toISOString(),
      consent_record_id: await createTestConsent(editor.id, { subject_name: memberName }),
    });
    const quote = `[DEMO] Aquí aprendí a sembrar ${tag}`;
    await admin.from("testimonials").insert({
      quote,
      author_display_name: "[DEMO] Doña Luz",
      author_context: "[DEMO] Vereda La Huerta",
      status: "published",
      published_at: new Date(Date.now() - 60_000).toISOString(),
      consent_record_id: await createTestConsent(editor.id, { subject_name: "[DEMO] Luz" }),
    });
    // Cómo apoyar still waits for its text
    await resetPage("support", PENDING("formas de apoyo aprobadas por la organización"));

    // An upcoming activity, published from the panel (this also refreshes the site)
    const { data: place } = await admin
      .from("places")
      .insert({ name: `[DEMO] Vereda ${tag}`, slug: `demo-vereda-${tag}`, kind: "vereda" })
      .select("id")
      .single();
    const { data: category } = await admin
      .from("categories")
      .insert({ scope: "activity", name: `[DEMO] Salud ${tag}`, slug: `demo-salud-${tag}` })
      .select("id")
      .single();
    const upcomingTitle = `[DEMO] Brigada de salud ${tag}`;
    const { data: activity } = await admin
      .from("activities")
      .insert({
        title: upcomingTitle,
        slug: `demo-brigada-${tag}`,
        status: "review",
        // Sooner than anything else in the database, so it is among the first three
        starts_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        place_id: place!.id,
        category_id: category!.id,
        created_by: editor.id,
      })
      .select("id")
      .single();
    await signInEnrollingMfa(page, editor);

    // Quiénes somos gets its text and is published from the panel
    const { data: about } = await admin.from("pages").select("id").eq("key", "about").single();
    await page.goto(`/admin/contenido/paginas/${about!.id}`);
    const body = page.getByRole("textbox", { name: "Texto" });
    await body.click();
    await page.keyboard.press("ControlOrMeta+a");
    await body.pressSequentially(aboutText);
    await expect(page.getByText(/Guardado a las/)).toBeVisible({ timeout: 10_000 });
    await page.reload();
    await page.getByRole("button", { name: "Publicar ahora" }).click();
    await expect(page.getByText(/· Publicada/)).toBeVisible();

    await page.goto(`/admin/actividades/${activity!.id}/editar?paso=4`);
    await page.getByRole("button", { name: "Publicar ahora" }).click();
    await expect(page).toHaveURL(/\/listo\?estado=published$/);

    // Home: the upcoming activity and the call to help
    await page.goto("/");
    await expect(
      page.getByRole("region", { name: "Próximas actividades" }).getByRole("link", {
        name: upcomingTitle,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "¿Quieres sumarte?" }).getByRole("link", {
        name: "Apóyanos",
      }),
    ).toHaveAttribute("href", "/apoyanos");
    expect(await axe(page)).toEqual([]);

    // Quiénes somos, from the menu
    await page
      .getByRole("navigation", { name: "Menú principal" })
      .getByRole("link", { name: "Quiénes somos" })
      .click();
    await expect(page).toHaveURL(/\/quienes-somos$/);
    await expect(page.getByText(aboutText)).toBeVisible();
    const team = page.getByRole("region", { name: "Equipo" });
    await expect(team.getByRole("heading", { name: memberName })).toBeVisible();
    await expect(team).toContainText("[DEMO] Coordinadora");
    await expect(page.getByRole("region", { name: "Testimonios" })).toContainText(quote);
    expect(await axe(page)).toEqual([]);

    // Apóyanos: no marker, a neutral note instead
    await page.goto("/apoyanos");
    await expect(page.getByText("Estamos preparando esta sección.")).toBeVisible();
    await expect(page.getByText("[PENDIENTE")).toHaveCount(0);
    expect(await axe(page)).toEqual([]);
  } finally {
    await resetPage(
      "about",
      PENDING("historia, misión y visión de la organización, aprobadas por ella"),
    );
  }
});

test("the legal pages are in the footer and never show a marker", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Política de tratamiento de datos" })
    .click();
  await expect(page).toHaveURL(/\/legal\/politica-de-datos$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("[PENDIENTE")).toHaveCount(0);

  await page.goto("/legal/aviso-de-privacidad");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("[PENDIENTE")).toHaveCount(0);
  expect(await axe(page)).toEqual([]);
});
