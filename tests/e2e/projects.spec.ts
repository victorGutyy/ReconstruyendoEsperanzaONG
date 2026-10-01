import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { createTestPhoto } from "./helpers/media";
import { goToSection } from "./helpers/panel";
import { sessionSwitcher } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Projects on the shared content engine, and activities that belong to them (step 7.6b)
test.skip(!hasSupabase, "needs a local Supabase with Storage");

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

async function publicKeyOf(mediaId: string) {
  const { data } = await adminClient()
    .from("media")
    .select("public_key")
    .eq("id", mediaId)
    .single();
  return (data?.public_key as string | null) ?? null;
}

test("an author writes a project, an editor publishes it and links an activity", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const tag = randomUUID().slice(0, 6);
  const author = await createTestUser("author");
  const editor = await createTestUser("editor");
  const alt = `[DEMO] Semillero ${tag}`;
  const mediaId = await createTestPhoto(author.id, { alt_text: alt, people_in_photo: "none" });
  const name = `[DEMO] Huertas comunitarias ${tag}`;
  const people = sessionSwitcher();

  // The author writes the draft; the dates must be in order
  await people.signIn(page, author);
  await goToSection(page, "Contenido");
  await page
    .getByRole("navigation", { name: "Tipos de contenido" })
    .getByRole("link", {
      name: "Proyectos",
    })
    .click();
  await expect(page).toHaveURL(/\/admin\/contenido\/proyectos$/);
  await page.getByRole("link", { name: "Nuevo proyecto" }).click();
  await page.getByRole("textbox", { name: "Nombre del proyecto" }).fill(name);
  await page.getByRole("textbox", { name: "Resumen" }).fill("[DEMO] Huertas en tres veredas.");
  await page.getByLabel("Estado del proyecto").selectOption("active");
  await page.getByLabel("Inicio (opcional)").fill("2026-05-01");
  await page.getByLabel("Fin (opcional)").fill("2026-04-01");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "La fecha de fin no puede ser anterior" }),
  ).toBeVisible();
  await page.getByLabel("Fin (opcional)").fill("2026-12-31");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/\/admin\/contenido\/proyectos\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop()!;
  await expect(page.getByLabel("Estado del proyecto")).toHaveValue("active");

  await page.getByRole("button", { name: "Elegir portada" }).click();
  const picker = page.getByRole("dialog", { name: "Biblioteca de fotos" });
  await picker.getByLabel("Solo subidas por mí").check();
  await picker.getByRole("checkbox", { name: alt }).check();
  await picker.getByRole("button", { name: "Usar como portada" }).click();
  await expect(page.getByRole("region", { name: "Portada" })).toContainText(alt);
  expect(await axe(page)).toEqual([]);

  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.getByText("Enviado a revisión. Un Editor lo revisará.")).toBeVisible();

  // The editor publishes it: the cover goes to the site
  await people.switchTo(page, editor);
  await page
    .getByRole("region", { name: "Pendientes" })
    .getByRole("link", { name: /proyectos? por revisar/ })
    .click();
  await page.getByRole("link", { name }).click();
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByText("Proyecto · Publicado")).toBeVisible();
  expect(await publicKeyOf(mediaId)).not.toBeNull();

  // An activity joins the project from step 1 of its wizard
  const activityTitle = `[DEMO] Siembra en la vereda ${tag}`;
  const { data: activity } = await adminClient()
    .from("activities")
    .insert({
      title: activityTitle,
      slug: `demo-siembra-${tag}`,
      starts_at: "2026-09-20T14:00:00Z",
      created_by: editor.id,
    })
    .select("id")
    .single();
  await page.goto(`/admin/actividades/${activity!.id}/editar?paso=1`);
  await page.getByLabel("Proyecto (opcional)").selectOption({ label: name });
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByText(/Guardado a las/)).toBeVisible();

  await page.goto(`/admin/contenido/proyectos/${id}`);
  await expect(
    page.getByRole("list", { name: "Actividades de este proyecto" }).getByRole("link"),
  ).toHaveText([activityTitle]);
});
