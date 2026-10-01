import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Content list, review queue and dashboard counts (step 7.4a, docs/07 §6.5)
test.skip(!hasSupabase, "needs a local Supabase with the secret key");

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

type Seed = { title: string; status: "draft" | "review" | "published"; createdBy: string };

/** Activities written straight to the database, all sharing a unique tag in the title. */
async function seedActivities(tag: string, seeds: Seed[]) {
  const admin = adminClient();
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

  const { error } = await admin.from("activities").insert(
    seeds.map((seed, index) => ({
      title: seed.title,
      slug: `demo-${tag}-${index}`,
      status: seed.status,
      starts_at: "2026-09-20T14:00:00Z",
      published_at: seed.status === "published" ? "2026-09-21T14:00:00Z" : null,
      created_by: seed.createdBy,
      place_id: place!.id,
      category_id: category!.id,
    })),
  );
  expect(error).toBeNull();
  return { placeId: place!.id, categoryId: category!.id };
}

const results = (page: Page) => page.getByRole("list", { name: "Actividades" });

test("an editor finds activities with filters and sees what waits for review", async ({ page }) => {
  const tag = randomUUID().slice(0, 6);
  const editor = await createTestUser("editor");
  const author = await createTestUser("author");
  const draft = `[DEMO] Borrador ${tag}`;
  const inReview = `[DEMO] Para revisar ${tag}`;
  const published = `[DEMO] Publicada ${tag}`;
  const { categoryId } = await seedActivities(tag, [
    { title: draft, status: "draft", createdBy: editor.id },
    { title: inReview, status: "review", createdBy: author.id },
    { title: published, status: "published", createdBy: author.id },
  ]);

  await signInEnrollingMfa(page, editor);

  // Dashboard: what waits for this person, each count leads to its list
  const pending = page.getByRole("region", { name: "Pendientes" });
  await expect(pending.getByRole("link", { name: /actividad(es)? por revisar/ })).toBeVisible();
  await pending.getByRole("link", { name: "1 borrador tuyo" }).click();
  await expect(page).toHaveURL(/\/admin\/actividades\?status=draft&mine=1$/);
  await expect(results(page).getByRole("link")).toHaveText([draft]);
  await expect(page.getByRole("link", { name: "Mías" })).toHaveAttribute("aria-current", "page");

  // Search by title: the three activities of this test
  await page.goto("/admin/actividades");
  await page.getByRole("searchbox", { name: "Título" }).fill(tag);
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(new RegExp(`q=${tag}`));
  await expect(results(page).getByRole("link")).toHaveCount(3);
  await expect(results(page)).toContainText("Publicada");
  expect(await axe(page)).toEqual([]);

  // Narrow down by state and category
  await page.getByLabel("Estado").selectOption("review");
  await page.getByLabel("Categoría").selectOption(categoryId);
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(results(page).getByRole("link")).toHaveText([inReview]);
  await expect(page.getByRole("link", { name: /^Por revisar/ })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Nothing found
  await page.goto(`/admin/actividades?q=${tag}&status=archived`);
  await expect(page.getByText("Ninguna actividad coincide con los filtros.")).toBeVisible();
  await page.getByRole("link", { name: "Quitar filtros" }).click();
  await expect(page).toHaveURL(/\/admin\/actividades$/);
});

test("an author sees their work in review but no review queue", async ({ page }) => {
  const tag = randomUUID().slice(0, 6);
  const author = await createTestUser("author");
  await seedActivities(tag, [
    { title: `[DEMO] Mía en revisión ${tag}`, status: "review", createdBy: author.id },
  ]);

  await signInEnrollingMfa(page, author);
  const pending = page.getByRole("region", { name: "Pendientes" });
  await expect(pending.getByRole("link", { name: "1 tuya en revisión" })).toBeVisible();
  await expect(pending.getByText(/por revisar/)).toHaveCount(0);

  await page.goto("/admin/actividades");
  await expect(page.getByRole("link", { name: /^Por revisar/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Mías" })).toBeVisible();
});
