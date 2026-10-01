import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { createTestPhoto } from "./helpers/media";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Public photos follow the published content (step 7.5a, docs/04 §5.3)
test.skip(!hasSupabase, "needs a local Supabase with Storage");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

const publicUrl = (key: string, size: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media-public/${key}/${size}.webp`;

async function publicKeyOf(mediaId: string) {
  const { data } = await adminClient()
    .from("media")
    .select("public_key")
    .eq("id", mediaId)
    .single();
  return (data?.public_key as string | null) ?? null;
}

test("publishing copies the photos to the public bucket and retiring removes them", async ({
  page,
  request,
}) => {
  const editor = await createTestUser("editor");
  const tag = randomUUID().slice(0, 6);
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
  const mediaId = await createTestPhoto(editor.id, {
    alt_text: `[DEMO] Árboles nuevos ${tag}`,
    people_in_photo: "none",
  });
  const { data: activity } = await admin
    .from("activities")
    .insert({
      title: `[DEMO] Jornada pública ${tag}`,
      slug: `demo-publica-${tag}`,
      starts_at: "2026-09-20T14:00:00Z",
      created_by: editor.id,
      place_id: place!.id,
      category_id: category!.id,
      cover_media_id: mediaId,
    })
    .select("id")
    .single();
  await admin
    .from("activity_media")
    .insert({ activity_id: activity!.id, media_id: mediaId, position: 1 });

  // A draft has nothing public
  expect(await publicKeyOf(mediaId)).toBeNull();

  await signInEnrollingMfa(page, editor);
  await page.goto(`/admin/actividades/${activity!.id}/editar?paso=4`);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page).toHaveURL(/\/listo\?estado=published$/);

  // Every size is public under a random key, without hidden data
  const key = await publicKeyOf(mediaId);
  expect(key).toMatch(/^[0-9a-f-]{36}$/);
  expect(key).not.toContain(mediaId);
  for (const size of ["sm", "md", "lg"]) {
    const response = await request.get(publicUrl(key!, size));
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/webp");
    if (size === "md") {
      const metadata = await sharp(await response.body()).metadata();
      expect(metadata.exif).toBeUndefined();
    }
  }

  await page.goto(`/admin/actividades/${activity!.id}/editar?paso=2`);
  await expect(page.getByText("En el sitio")).toBeVisible();

  // Retiring it takes the photo off the public bucket at once
  await page.getByRole("button", { name: "Retirar para corregir" }).click();
  await page
    .getByRole("dialog", { name: "Retirar para corregir" })
    .getByRole("button", { name: "Retirar del sitio" })
    .click();
  await expect(page.getByText("Actividad · Borrador")).toBeVisible();
  expect(await publicKeyOf(mediaId)).toBeNull();
  expect((await request.get(publicUrl(key!, "md"))).ok()).toBe(false);
  await expect(page.getByText("En el sitio")).toHaveCount(0);
});
