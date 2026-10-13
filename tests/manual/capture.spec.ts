import { randomUUID } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";

import { completeMfaEnrollment } from "../e2e/helpers/session";
import { adminClient, createTestUser, randomClientIp } from "../e2e/helpers/users";

// Screenshots for docs/11-manual-de-uso.md (step 10.4). [DEMO] data only.

const shot = (page: Page, name: string, mask: string[] = []) =>
  page.screenshot({
    path: `docs/manual/${name}.jpg`,
    type: "jpeg",
    quality: 70,
    mask: mask.map((selector) => page.locator(selector)),
    maskColor: "#d9d2c3",
  });

const photo = (color: string) =>
  sharp({ create: { width: 1200, height: 900, channels: 3, background: color } })
    .jpeg()
    .toBuffer();

test("manual screenshots", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
  const admin = adminClient();
  const tag = randomUUID().slice(0, 4);
  const user = await createTestUser("admin");
  const { data: place } = await admin
    .from("places")
    .insert({ name: "[DEMO] Vereda La Huerta", slug: `demo-la-huerta-${tag}`, kind: "vereda" })
    .select("id")
    .single();
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "activity", name: "[DEMO] Salud", slug: `demo-salud-manual-${tag}` })
    .select("id")
    .single();
  await admin.from("contact_messages").insert({
    full_name: "[DEMO] Vecina de Calarcá",
    email: `vecina-${tag}@example.test`,
    message: "[DEMO] Quiero ayudar en la próxima jornada de salud.",
    privacy_policy_version: "1.0",
    consent_accepted_at: new Date().toISOString(),
  });

  // 1. Entrar
  await page.goto("/admin/login");
  await shot(page, "01-entrar");
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Protege tu cuenta" })).toBeVisible();
  // The QR and the key are covered even though this is a throwaway test user
  await shot(page, "02-proteger-cuenta", ['img[alt^="Código QR"]', '[data-testid="mfa-secret"]']);
  await completeMfaEnrollment(page);
  await shot(page, "03-inicio-del-panel");

  // 2. Una actividad desde el celular
  await page.goto("/admin/actividades/nueva");
  await page.getByRole("textbox", { name: "Título", exact: true }).fill("[DEMO] Jornada de salud");
  await page.getByLabel("Fecha").fill("2026-09-20");
  await page.getByLabel("Hora de inicio").fill("09:00");
  await page.getByLabel("Lugar general").selectOption(place!.id);
  await page.getByLabel("Categoría").selectOption(category!.id);
  await page.getByLabel("Resumen").fill("[DEMO] Atendimos a 40 personas de la vereda.");
  await shot(page, "04-actividad-lo-basico");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/paso=2$/);

  await page.getByLabel(/Tomar o elegir fotos/).setInputFiles(
    await Promise.all(
      ["#6b8f5e", "#b79a4b"].map(async (color, i) => ({
        name: `foto-${i + 1}.jpg`,
        mimeType: "image/jpeg",
        buffer: await photo(color),
      })),
    ),
  );
  const photos = page.getByRole("list", { name: "Fotos de la actividad" });
  await expect(photos.getByRole("listitem")).toHaveCount(2, { timeout: 60_000 });
  for (const n of [1, 2]) {
    const description = page.getByLabel(`Descripción de la foto ${n}`, { exact: true });
    await description.fill(n === 1 ? "[DEMO] Consulta médica" : "[DEMO] Entrega de medicamentos");
    await description.blur();
    await expect(page.getByText("Descripción guardada.").first()).toBeVisible();
  }
  await shot(page, "05-actividad-fotos");
  await page.getByRole("link", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/paso=3$/);

  for (const n of [1, 2]) {
    await page
      .getByRole("group", { name: new RegExp(`^Foto ${n}(?![0-9]).*aparecen personas`) })
      .getByRole("radio", { name: "No", exact: true })
      .check();
  }
  // Asked only when some photo shows people
  const confirm = page.getByLabel(/Confirmo que todas las personas/);
  if (await confirm.isVisible()) await confirm.check();
  await shot(page, "06-actividad-personas");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/paso=4$/);
  await shot(page, "07-actividad-revisar");
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByRole("heading", { name: "¡Actividad publicada!" })).toBeVisible();
  await shot(page, "08-actividad-publicada");

  // 3. Autorizaciones de imagen
  await page.goto("/admin/autorizaciones/nueva");
  await page.getByLabel("Persona que aparece en las fotos").fill("[DEMO] Ana Ruiz");
  await page.getByLabel("Qué cubre").fill("[DEMO] Fotos de la jornada de salud");
  await page.getByLabel("Fecha de firma").fill("2026-09-20");
  await page.getByLabel("Versión del formato").fill("v1");
  await shot(page, "09-autorizacion-nueva");

  // 4. Mensajes, papelera, usuarios, configuración
  await page.goto("/admin/mensajes");
  await expect(page.getByRole("heading", { name: "Mensajes", level: 1 })).toBeVisible();
  await shot(page, "10-mensajes");
  await page.getByRole("list", { name: "Mensajes" }).getByRole("link").first().click();
  await expect(page.getByRole("button", { name: "Marcar como atendido" })).toBeVisible();
  await shot(page, "11-mensaje");
  await page.goto("/admin/medios");
  await shot(page, "12-medios");
  await page.goto("/admin/papelera");
  await shot(page, "13-papelera");
  await page.goto("/admin/usuarios");
  await shot(page, "14-usuarios");
  await page.goto("/admin/configuracion");
  await shot(page, "15-configuracion");
});
