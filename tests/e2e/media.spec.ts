import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { goToSection } from "./helpers/panel";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Photo uploads (step 6.3, docs/04 §5.3, docs/05 §6.1)
test.skip(!hasSupabase, "needs a local Supabase with Storage");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

/** A phone-like photo with GPS coordinates in its EXIF. */
function photoWithGps() {
  return sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#6b8f5e" } })
    .jpeg({ quality: 90 })
    .withExif({
      IFD0: { Make: "DemoPhone" },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "4/1 31/1 0/1",
        GPSLongitudeRef: "W",
        GPSLongitude: "75/1 41/1 0/1",
      },
    })
    .toBuffer();
}

test("an author uploads a photo and it is stored without location or metadata", async ({
  page,
}) => {
  const author = await createTestUser("author");
  await signInEnrollingMfa(page, author);
  await goToSection(page, "Medios");
  await expect(page.getByRole("heading", { name: "Medios", level: 1 })).toBeVisible();

  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  const original = await photoWithGps();
  expect((await sharp(original).metadata()).exif).toBeDefined();

  await page.getByLabel(/Elegir fotos/).setInputFiles({
    name: "IMG_0001.jpg",
    mimeType: "image/jpeg",
    buffer: original,
  });

  const uploading = page.getByRole("list", { name: "Fotos que estás subiendo" });
  await expect(uploading.getByRole("listitem").filter({ hasText: "IMG_0001.jpg" })).toContainText(
    "Lista",
    { timeout: 20_000 },
  );

  // It appears in the library among the person's photos, with a thumbnail
  await page.getByRole("link", { name: "Subidas por mí" }).click();
  const library = page.getByRole("list", { name: "Biblioteca de fotos" });
  await expect(library.getByRole("link", { name: /^Abrir:/ })).toHaveCount(1);
  await expect(library.locator("img")).toHaveCount(1);

  // What was stored: three WebP sizes without EXIF/GPS, and no original left
  const admin = adminClient();
  const { data: media } = await admin
    .from("media")
    .select("id, processing_status, private_path, width, height, mime_type")
    .eq("uploaded_by", author.id)
    .single();
  expect(media).toMatchObject({
    processing_status: "ready",
    private_path: media!.id,
    mime_type: "image/webp",
    width: 1920,
    height: 1280,
  });

  for (const size of ["sm", "md", "lg"]) {
    const { data: file, error } = await admin.storage
      .from("media-private")
      .download(`${media!.id}/${size}.webp`);
    expect(error).toBeNull();
    const bytes = Buffer.from(await file!.arrayBuffer());
    const metadata = await sharp(bytes).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
    expect(bytes.includes(Buffer.from("DemoPhone"))).toBe(false);
  }

  const { error: originalGone } = await admin.storage.from("media-incoming").download(media!.id);
  expect(originalGone).not.toBeNull();

  // The audit log names the author as the one who added the photo
  const { data: audit } = await admin
    .from("audit_logs")
    .select("action, actor_id")
    .eq("table_name", "media")
    .eq("record_id", media!.id)
    .eq("action", "insert")
    .single();
  expect(audit).toEqual({ action: "insert", actor_id: author.id });
});

test("a file that is not a photo gets a clear message and can be removed", async ({ page }) => {
  const author = await createTestUser("author");
  await signInEnrollingMfa(page, author);
  await page.goto("/admin/medios");

  await page.getByLabel(/Elegir fotos/).setInputFiles({
    name: "no-es-foto.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("esto no es una imagen"),
  });

  const item = page
    .getByRole("list", { name: "Fotos que estás subiendo" })
    .getByRole("listitem")
    .filter({ hasText: "no-es-foto.jpg" });
  await expect(item.getByRole("alert")).toContainText("no pudo abrir la foto");
  await item.getByRole("button", { name: "Quitar" }).click();
  await expect(item).toHaveCount(0);

  // Nothing was created for it
  const { count } = await adminClient()
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("uploaded_by", author.id);
  expect(count).toBe(0);
});
