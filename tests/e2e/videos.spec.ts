import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { sessionSwitcher } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Videos by their link: provider + id only, no player in the panel (step 7.6c)
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

/** A YouTube-shaped id that no other test uses. */
const youtubeId = () => randomUUID().replace(/-/g, "").slice(0, 11);

test("an author adds a video by its link and an editor publishes it", async ({ page }) => {
  test.setTimeout(120_000);
  const author = await createTestUser("author");
  const editor = await createTestUser("editor");
  const id = youtubeId();
  const title = `[DEMO] La siembra en video ${id}`;
  const people = sessionSwitcher();

  await people.signIn(page, author);
  await page.goto("/admin/contenido/videos/nuevo");
  const link = page.getByRole("textbox", { name: "Enlace del video" });

  // Short links are refused instead of being followed
  await link.fill("https://fb.watch/abc123/");
  await expect(page.getByText(/Ese es un enlace corto/)).toBeVisible();

  // A full link is recognized; it opens on YouTube, nothing is embedded here
  await link.fill(`https://www.youtube.com/watch?v=${id}&t=42s&si=tracking`);
  await expect(page.getByText(`Video de YouTube reconocido (${id}).`)).toBeVisible();
  const watch = page.getByRole("link", { name: /Ver en YouTube/ });
  await expect(watch).toHaveAttribute("href", `https://www.youtube.com/watch?v=${id}`);
  await expect(watch).toHaveAttribute("target", "_blank");
  await expect(page.locator("iframe")).toHaveCount(0);

  await page.getByRole("textbox", { name: "Título" }).fill(title);
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/\/admin\/contenido\/videos\/[0-9a-f-]{36}$/);
  const videoId = page.url().split("/").pop()!;
  expect(await axe(page)).toEqual([]);

  // Only the provider and the id are stored, not the pasted link
  const { data: row } = await adminClient().from("videos").select("*").eq("id", videoId).single();
  expect(row).toMatchObject({ provider: "youtube", provider_video_id: id });
  expect(JSON.stringify(row)).not.toContain("tracking");

  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.getByText("Enviado a revisión. Un Editor lo revisará.")).toBeVisible();

  // The same video cannot be registered twice
  await page.goto("/admin/contenido/videos/nuevo");
  await page.getByRole("textbox", { name: "Enlace del video" }).fill(`https://youtu.be/${id}`);
  await page.getByRole("textbox", { name: "Título" }).fill("[DEMO] Repetido");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Ese video ya está registrado." }),
  ).toBeVisible();

  // The editor publishes it
  await people.switchTo(page, editor);
  await page.goto(`/admin/contenido/videos/${videoId}`);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByText("Video · Publicado")).toBeVisible();
});
