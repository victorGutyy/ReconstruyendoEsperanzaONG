import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { createTestPhoto } from "./helpers/media";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Public projects (step 8.3b, RF-A-05): grouped by stage, each with its
// published activities; an activity links to its project only while it is public.
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

test("a published project shows its stage and its activities, linked both ways", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const editor = await createTestUser("editor");
  const tag = randomUUID().slice(0, 6);
  const admin = adminClient();
  const mediaId = await createTestPhoto(editor.id, {
    alt_text: `[DEMO] Huerta ${tag}`,
    people_in_photo: "none",
  });
  const title = `[DEMO] Huertas familiares ${tag}`;
  const slug = `demo-huertas-${tag}`;
  const { data: project } = await admin
    .from("projects")
    .insert({
      title,
      slug,
      status: "review",
      summary: "[DEMO] Huertas en tres veredas.",
      objective: "[DEMO] Que cada familia tenga su huerta.",
      project_status: "active",
      start_date: "2026-03-01",
      cover_media_id: mediaId,
      created_by: editor.id,
    })
    .select("id")
    .single();

  const { data: place } = await admin
    .from("places")
    .insert({ name: `[DEMO] Vereda ${tag}`, slug: `demo-vereda-${tag}`, kind: "vereda" })
    .select("id")
    .single();
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "activity", name: `[DEMO] Siembra ${tag}`, slug: `demo-siembra-${tag}` })
    .select("id")
    .single();
  const activityTitle = `[DEMO] Primera siembra ${tag}`;
  const activitySlug = `demo-primera-siembra-${tag}`;
  const { error: activitiesError } = await admin.from("activities").insert([
    {
      title: activityTitle,
      slug: activitySlug,
      status: "published",
      published_at: "2026-03-10T14:00:00Z",
      starts_at: "2026-03-08T14:00:00Z",
      place_id: place!.id,
      category_id: category!.id,
      project_id: project!.id,
    },
    {
      title: `[DEMO] Borrador del proyecto ${tag}`,
      slug: `demo-borrador-proyecto-${tag}`,
      // In a bulk insert a missing column is null, not its default
      status: "draft",
      starts_at: "2026-03-09T14:00:00Z",
      project_id: project!.id,
    },
  ]);
  expect(activitiesError).toBeNull();

  // While the project is not public, the activity does not link to it
  await page.goto(`/actividades/${activitySlug}`);
  await expect(page.getByRole("region", { name: "Ficha" })).not.toContainText(title);

  await signInEnrollingMfa(page, editor);
  await page.goto(`/admin/contenido/proyectos/${project!.id}`);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByText("Proyecto · Publicado")).toBeVisible();

  // The listing groups it under "En curso"
  await page.goto("/proyectos");
  const inProgress = page.getByRole("region", { name: "En curso" });
  await expect(inProgress.getByRole("link", { name: title })).toBeVisible();
  await expect(inProgress).toContainText("Desde marzo de 2026");
  expect(await axe(page)).toEqual([]);

  // The project: objective, facts and only its published activities
  await inProgress.getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${slug}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByRole("region", { name: "Objetivo" })).toContainText(
    "Que cada familia tenga su huerta",
  );
  const activities = page.getByRole("region", { name: "Actividades del proyecto" });
  await expect(activities.getByRole("link", { name: activityTitle })).toBeVisible();
  await expect(page.getByText(`[DEMO] Borrador del proyecto ${tag}`)).toHaveCount(0);
  expect(await axe(page)).toEqual([]);

  // And the activity links back to its project
  await activities.getByRole("link", { name: activityTitle }).click();
  await page.getByRole("region", { name: "Ficha" }).getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${slug}$`));

  // Retired: the project page is gone and the activity no longer links to it
  await page.goto(`/admin/contenido/proyectos/${project!.id}`);
  await page.getByRole("button", { name: "Retirar para corregir" }).click();
  await page
    .getByRole("dialog", { name: "Retirar para corregir" })
    .getByRole("button", { name: "Retirar del sitio" })
    .click();
  await expect(page.getByText("Proyecto · Borrador")).toBeVisible();
  expect((await page.goto(`/proyectos/${slug}`))?.status()).toBe(404);
  await page.goto(`/actividades/${activitySlug}`);
  await expect(page.getByRole("region", { name: "Ficha" })).not.toContainText(title);
});
