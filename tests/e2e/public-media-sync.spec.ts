import { randomUUID } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

import { createTestConsent, createTestPhoto } from "./helpers/media";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

// Photos leave the site when their authorization goes away and come back when
// a valid one is linked; a daily job is the safety net (step 7.5b)
test.skip(!hasSupabase, "needs a local Supabase with Storage");

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

const publicUrl = (key: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media-public/${key}/md.webp`;

async function publicKeyOf(mediaId: string) {
  const { data } = await adminClient()
    .from("media")
    .select("public_key")
    .eq("id", mediaId)
    .single();
  return (data?.public_key as string | null) ?? null;
}

const panel = (page: Page) => page.getByRole("region", { name: "Autorizaciones de esta foto" });

test("revoking an authorization takes the photo off the site and flags the activity", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const editor = await createTestUser("editor");
  const tag = randomUUID().slice(0, 6);
  const admin = adminClient();
  const { data: place } = await admin
    .from("places")
    .insert({ name: `[DEMO] Barrio ${tag}`, slug: `demo-barrio-${tag}`, kind: "neighborhood" })
    .select("id")
    .single();
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "activity", name: `[DEMO] Taller ${tag}`, slug: `demo-taller-${tag}` })
    .select("id")
    .single();
  const mediaId = await createTestPhoto(editor.id, {
    alt_text: `[DEMO] Taller de tejido ${tag}`,
    people_in_photo: "identifiable",
  });
  const first = `[DEMO] Señora ${tag}`;
  const consentId = await createTestConsent(editor.id, { subject_name: first });
  await admin.from("media_consents").insert({ media_id: mediaId, consent_record_id: consentId });
  const title = `[DEMO] Tejido comunitario ${tag}`;
  const { data: activity } = await admin
    .from("activities")
    .insert({
      title,
      slug: `demo-tejido-${tag}`,
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

  await signInEnrollingMfa(page, editor);
  await page.goto(`/admin/actividades/${activity!.id}/editar?paso=4`);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page).toHaveURL(/\/listo\?estado=published$/);
  const key = await publicKeyOf(mediaId);
  expect((await request.get(publicUrl(key!))).status()).toBe(200);

  // Revoke the authorization: the photo leaves the site at once
  await page.goto(`/admin/autorizaciones/${consentId}`);
  await page.getByRole("button", { name: "Revocar autorización" }).click();
  await page.getByLabel("Motivo (quién lo pidió y cuándo)").fill("[DEMO] Ella lo pidió");
  await page.getByRole("button", { name: "Sí, revocar" }).click();
  await expect(page.getByText("Revocada", { exact: true })).toBeVisible();
  expect(await publicKeyOf(mediaId)).toBeNull();
  expect((await request.get(publicUrl(key!))).ok()).toBe(false);

  // The activity stays published, flagged in Pendientes, the list and its page
  await page.goto("/admin");
  await page
    .getByRole("region", { name: "Pendientes" })
    .getByRole("link", { name: /con fotos retiradas/ })
    .click();
  await expect(page).toHaveURL(/withdrawn=1/);
  const row = page.getByRole("listitem").filter({ hasText: title });
  await expect(row).toContainText("Fotos retiradas");
  await expect(row).toContainText("Publicada");
  await row.getByRole("link", { name: title }).click();
  const notice = page.getByRole("region", { name: /Fotos retiradas del sitio/ });
  await expect(notice).toContainText("Falta autorización");

  // A valid authorization linked to the photo brings it back, at a new address
  const second = `[DEMO] Señora nueva ${tag}`;
  await createTestConsent(editor.id, { subject_name: second });
  await notice.getByRole("link", { name: /Resolver/ }).click();
  await panel(page).getByLabel("Vincular una autorización").fill(second);
  await panel(page).getByRole("button", { name: "Buscar" }).click();
  await panel(page)
    .getByRole("list", { name: "Autorizaciones encontradas" })
    .getByRole("button", { name: `Vincular: ${second}` })
    .click();
  await expect(panel(page).getByRole("list", { name: "Autorizaciones vinculadas" })).toContainText(
    second,
  );

  const newKey = await publicKeyOf(mediaId);
  expect(newKey).not.toBeNull();
  expect(newKey).not.toBe(key);
  expect((await request.get(publicUrl(newKey!))).status()).toBe(200);

  await page.goto(`/admin/actividades/${activity!.id}/editar`);
  await expect(page.getByRole("region", { name: /Fotos retiradas del sitio/ })).toHaveCount(0);
});

test("the daily job only runs with the secret", async ({ request }) => {
  const url = "/api/cron/media-sync";
  expect((await request.get(url)).status()).toBe(401);
  expect(
    (await request.get(url, { headers: { authorization: "Bearer not-the-secret" } })).status(),
  ).toBe(401);

  const response = await request.get(url, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(["failed", "published", "withdrawn"]);
});
