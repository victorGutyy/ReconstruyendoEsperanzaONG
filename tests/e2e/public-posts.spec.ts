import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { createTestPhoto } from "./helpers/media";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Public stories (step 8.3): tagged in the panel, published by an editor,
// shown with their public signature and tags; drafts never; retiring hides it.
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

test("an editor tags and publishes a story, and the site shows it with its signature", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const editor = await createTestUser("editor");
  const tag = randomUUID().slice(0, 6);
  const admin = adminClient();
  const categorySlug = `demo-voces-${tag}`;
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "post", name: `[DEMO] Voces ${tag}`, slug: categorySlug })
    .select("id")
    .single();
  const tagName = `[DEMO] Agua ${tag}`;
  await admin.from("tags").insert({ name: tagName, slug: `demo-agua-${tag}` });
  const mediaId = await createTestPhoto(editor.id, {
    alt_text: `[DEMO] Río ${tag}`,
    people_in_photo: "none",
  });
  const title = `[DEMO] La quebrada volvió ${tag}`;
  const slug = `demo-quebrada-${tag}`;
  const { data: post } = await admin
    .from("posts")
    .insert({
      title,
      slug,
      status: "review",
      excerpt: "[DEMO] Cómo la vereda limpió su quebrada.",
      byline: "[DEMO] Equipo del barrio",
      category_id: category!.id,
      cover_media_id: mediaId,
      created_by: editor.id,
    })
    .select("id")
    .single();
  const draftTitle = `[DEMO] Borrador ${tag}`;
  await admin.from("posts").insert({
    title: draftTitle,
    slug: `demo-borrador-${tag}`,
    category_id: category!.id,
  });

  expect((await page.goto(`/historias/${slug}`))?.status()).toBe(404);

  // The editor tags it (saved at once) and publishes it
  await signInEnrollingMfa(page, editor);
  await page.goto(`/admin/contenido/historias/${post!.id}`);
  await page.getByRole("checkbox", { name: tagName }).check();
  await expect
    .poll(async () => {
      const { data } = await admin.from("post_tags").select("tag_id").eq("post_id", post!.id);
      return data?.length;
    })
    .toBe(1);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByText("Historia · Publicada")).toBeVisible();

  // The listing, by its category: published yes, draft no
  await page.goto(`/historias?categoria=${categorySlug}`);
  const list = page.getByRole("list", { name: "Historias" });
  await expect(list.getByRole("link", { name: title })).toBeVisible();
  await expect(list).toContainText("[DEMO] Equipo del barrio");
  await expect(page.getByText(draftTitle)).toHaveCount(0);
  expect(await axe(page)).toEqual([]);

  // The story: signature, tags, cover, what WhatsApp reads
  await list.getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`/historias/${slug}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByText("Por [DEMO] Equipo del barrio")).toBeVisible();
  await expect(page.getByRole("region", { name: "Etiquetas" })).toContainText(tagName);
  await expect(page.getByRole("img", { name: `[DEMO] Río ${tag}` })).toBeVisible();
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
  expect(await axe(page)).toEqual([]);

  // Retired: gone from the site at once
  await page.goto(`/admin/contenido/historias/${post!.id}`);
  await page.getByRole("button", { name: "Retirar para corregir" }).click();
  await page
    .getByRole("dialog", { name: "Retirar para corregir" })
    .getByRole("button", { name: "Retirar del sitio" })
    .click();
  await expect(page.getByText("Historia · Borrador")).toBeVisible();
  expect((await page.goto(`/historias/${slug}`))?.status()).toBe(404);
});

test("a story without a signature never shows who wrote it in the panel", async ({ page }) => {
  const author = await createTestUser("author");
  const tag = randomUUID().slice(0, 6);
  const admin = adminClient();
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "post", name: `[DEMO] Notas ${tag}`, slug: `demo-notas-${tag}` })
    .select("id")
    .single();
  const slug = `demo-sin-firma-${tag}`;
  await admin.from("posts").insert({
    title: `[DEMO] Sin firma ${tag}`,
    slug,
    status: "published",
    published_at: new Date(Date.now() - 60_000).toISOString(),
    excerpt: "[DEMO] Una nota corta.",
    category_id: category!.id,
    created_by: author.id,
  });

  await page.goto(`/historias/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`[DEMO] Sin firma ${tag}`);
  await expect(page.getByText(author.fullName)).toHaveCount(0);
  await expect(page.getByText(/^Por /)).toHaveCount(0);
});
