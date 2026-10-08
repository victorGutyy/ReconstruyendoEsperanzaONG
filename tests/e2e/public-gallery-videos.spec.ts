import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { createTestPhoto } from "./helpers/media";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Public galleries and videos (step 8.4): an album with its viewer and its
// activity; videos as our own photo until "Reproducir", Facebook only as a link.
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

test("an album shows its photos and its activity; videos load the player only on request", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const editor = await createTestUser("editor");
  const tag = randomUUID().slice(0, 6);
  const admin = adminClient();

  // A published activity the album and the videos belong to
  const { data: place } = await admin
    .from("places")
    .insert({ name: `[DEMO] Vereda ${tag}`, slug: `demo-vereda-${tag}`, kind: "vereda" })
    .select("id")
    .single();
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "activity", name: `[DEMO] Cultura ${tag}`, slug: `demo-cultura-${tag}` })
    .select("id")
    .single();
  const activityTitle = `[DEMO] Festival ${tag}`;
  const activitySlug = `demo-festival-${tag}`;
  const { data: activity } = await admin
    .from("activities")
    .insert({
      title: activityTitle,
      slug: activitySlug,
      status: "published",
      published_at: "2026-04-02T14:00:00Z",
      starts_at: "2026-04-01T14:00:00Z",
      place_id: place!.id,
      category_id: category!.id,
    })
    .select("id")
    .single();

  // Two published videos: YouTube (embedded on request) and Facebook (link only)
  const youtubeId = `Yt${randomUUID().replace(/-/g, "").slice(0, 9)}`;
  const facebookId = String(Date.now()) + String(Math.floor(Math.random() * 1000));
  const youtubeTitle = `[DEMO] Danzas del festival ${tag}`;
  const facebookTitle = `[DEMO] Transmisión del festival ${tag}`;
  const { error: videosError } = await admin.from("videos").insert([
    {
      title: youtubeTitle,
      provider: "youtube",
      provider_video_id: youtubeId,
      status: "published",
      published_at: "2026-04-03T14:00:00Z",
      activity_id: activity!.id,
    },
    {
      title: facebookTitle,
      provider: "facebook",
      provider_video_id: facebookId,
      status: "published",
      published_at: "2026-04-03T15:00:00Z",
      activity_id: activity!.id,
    },
  ]);
  expect(videosError).toBeNull();

  // The album, sent to review, published by the editor from the panel
  const alt = `[DEMO] Comparsa ${tag}`;
  const mediaId = await createTestPhoto(editor.id, { alt_text: alt, people_in_photo: "none" });
  const galleryTitle = `[DEMO] Fotos del festival ${tag}`;
  const gallerySlug = `demo-fotos-festival-${tag}`;
  const { data: gallery } = await admin
    .from("galleries")
    .insert({
      title: galleryTitle,
      slug: gallerySlug,
      status: "review",
      description: "[DEMO] Un día de música y danza.",
      activity_id: activity!.id,
      cover_media_id: mediaId,
      created_by: editor.id,
    })
    .select("id")
    .single();
  await admin.from("gallery_items").insert({
    gallery_id: gallery!.id,
    media_id: mediaId,
    position: 1,
    caption: "[DEMO] La comparsa",
  });

  await signInEnrollingMfa(page, editor);
  await page.goto(`/admin/contenido/galerias/${gallery!.id}`);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByText(/Galería · Publicada/)).toBeVisible();

  // The gallery: the album card, then the album with its activity and viewer
  await page.goto("/galeria");
  const albums = page.getByRole("list", { name: "Álbumes" });
  await expect(albums.getByRole("listitem").filter({ hasText: galleryTitle })).toContainText(
    "1 foto",
  );
  expect(await axe(page)).toEqual([]);
  await albums.getByRole("link", { name: galleryTitle }).click();
  await expect(page).toHaveURL(new RegExp(`/galeria/${gallerySlug}$`));
  await expect(page.getByRole("link", { name: activityTitle })).toHaveAttribute(
    "href",
    `/actividades/${activitySlug}`,
  );
  await page
    .getByRole("list", { name: "Fotos del álbum" })
    .getByRole("button", { name: /Ver foto 1 de 1/ })
    .click();
  const viewer = page.getByRole("dialog", { name: "Foto 1 de 1" });
  await expect(viewer.getByRole("img", { name: alt })).toBeVisible();
  await expect(viewer).toContainText("[DEMO] La comparsa");
  await page.keyboard.press("Escape");
  expect(await axe(page)).toEqual([]);

  // The activity shows its videos: nothing loaded from YouTube until asked
  await page.goto(`/actividades/${activitySlug}`);
  const videos = page.getByRole("region", { name: "Videos" });
  await expect(videos.locator("iframe")).toHaveCount(0);
  await expect(videos.getByRole("link", { name: /Ver en Facebook/ })).toHaveAttribute(
    "href",
    `https://www.facebook.com/watch/?v=${facebookId}`,
  );
  expect(await axe(page)).toEqual([]);
  await videos.getByRole("button", { name: `Reproducir: ${youtubeTitle}` }).click();
  const player = videos.locator("iframe");
  await expect(player).toHaveCount(1);
  await expect(player).toHaveAttribute(
    "src",
    `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&autoplay=1`,
  );
  await expect(player).toHaveAttribute("title", `Video: ${youtubeTitle}`);

  // The videos page lists them too (from the footer)
  await page.getByRole("contentinfo").getByRole("link", { name: "Videos" }).click();
  await expect(page).toHaveURL(/\/videos$/);
  await expect(page.getByRole("list", { name: "Videos" })).toContainText(youtubeTitle);

  // Retired: the album is gone at once
  await page.goto(`/admin/contenido/galerias/${gallery!.id}`);
  await page.getByRole("button", { name: "Retirar para corregir" }).click();
  await page
    .getByRole("dialog", { name: "Retirar para corregir" })
    .getByRole("button", { name: "Retirar del sitio" })
    .click();
  await expect(page.getByText(/Galería · Borrador/)).toBeVisible();
  expect((await page.goto(`/galeria/${gallerySlug}`))?.status()).toBe(404);
});
