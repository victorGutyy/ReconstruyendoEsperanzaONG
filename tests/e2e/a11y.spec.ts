import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { failOnCspViolations } from "./helpers/csp";
import { createTestConsent, createTestPhoto } from "./helpers/media";
import { signInEnrollingMfa } from "./helpers/session";
import { adminClient, createTestUser, hasSupabase, randomClientIp } from "./helpers/users";

failOnCspViolations();

// Accessibility sweep (step 9.6, docs/07 §8): every page of the site and of
// the panel passes axe (WCAG 2.2 AA) on phone and desktop. The route list is
// checked against the pages in src/app, so a new page cannot skip it.

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Each page of src/app, as its route pattern, with how this spec covers it. */
const COVERED: Record<string, string> = {
  "/": "public",
  "/actividades": "public",
  "/actividades/[slug]": "public",
  "/apoyanos": "public",
  "/buscar": "public",
  "/contacto": "public",
  "/galeria": "public",
  "/galeria/[slug]": "public",
  "/historias": "public",
  "/historias/[slug]": "public",
  "/legal/aviso-de-privacidad": "public",
  "/legal/politica-de-datos": "public",
  "/memoria": "public",
  "/proyectos": "public",
  "/proyectos/[slug]": "public",
  "/quienes-somos": "public",
  "/videos": "public",
  "/admin/login": "signed out",
  "/admin/recuperar": "signed out",
  // Need a half-finished session (password without code / recovery link):
  // axe runs on them in auth.spec and users.spec
  "/admin/mfa": "auth.spec",
  "/admin/restablecer": "users.spec",
  "/admin": "panel",
  "/admin/actividades": "panel",
  "/admin/actividades/[id]/editar": "panel",
  "/admin/actividades/[id]/listo": "panel",
  "/admin/actividades/nueva": "panel",
  "/admin/auditoria": "panel",
  "/admin/autorizaciones": "panel",
  "/admin/autorizaciones/[id]": "panel",
  "/admin/autorizaciones/nueva": "panel",
  "/admin/categorias-y-lugares": "panel",
  "/admin/configuracion": "panel",
  "/admin/contenido": "panel",
  "/admin/contenido/equipo": "panel",
  "/admin/contenido/equipo/[id]": "panel",
  "/admin/contenido/equipo/nueva": "panel",
  "/admin/contenido/galerias": "panel",
  "/admin/contenido/galerias/[id]": "panel",
  "/admin/contenido/galerias/nueva": "panel",
  "/admin/contenido/historias": "panel",
  "/admin/contenido/historias/[id]": "panel",
  "/admin/contenido/historias/nueva": "panel",
  "/admin/contenido/paginas": "panel",
  "/admin/contenido/paginas/[id]": "panel",
  "/admin/contenido/proyectos": "panel",
  "/admin/contenido/proyectos/[id]": "panel",
  "/admin/contenido/proyectos/nuevo": "panel",
  "/admin/contenido/testimonios": "panel",
  "/admin/contenido/testimonios/[id]": "panel",
  "/admin/contenido/testimonios/nuevo": "panel",
  "/admin/contenido/videos": "panel",
  "/admin/contenido/videos/[id]": "panel",
  "/admin/contenido/videos/nuevo": "panel",
  "/admin/medios": "panel",
  "/admin/medios/[id]": "panel",
  "/admin/mensajes": "panel",
  "/admin/mensajes/[id]": "panel",
  "/admin/papelera": "panel",
  "/admin/usuarios": "panel",
};

/** Route patterns of every page.tsx under src/app, route groups removed. */
function appRoutes(): string[] {
  const root = join(process.cwd(), "src", "app");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name === "page.tsx" ? [dir] : [],
    );
  return walk(root).map((dir) => {
    const parts = relative(root, dir)
      .split(sep)
      .filter((part) => part && !/^\(.*\)$/.test(part));
    return `/${parts.join("/")}`;
  });
}

async function expectAccessible(page: Page, url: string) {
  const response = await page.goto(url);
  expect(response?.status(), url).toBeLessThan(400);
  await expect(page.locator("h1").first(), url).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(
    violations.map((violation) => `${url}: ${violation.id} (${violation.nodes.length})`),
  ).toEqual([]);
}

test("every page of the site is in this sweep", () => {
  expect(appRoutes().sort()).toEqual(Object.keys(COVERED).sort());
});

test("every public page passes axe, details included", async ({ page }) => {
  test.skip(!hasSupabase, "needs a local Supabase");
  test.setTimeout(240_000);
  const editor = await createTestUser("editor");
  const admin = adminClient();
  const tag = randomUUID().slice(0, 6);
  const published = {
    status: "published",
    published_at: new Date(Date.now() - 60_000).toISOString(),
  };

  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "activity", name: `[DEMO] Salud ${tag}`, slug: `demo-salud-a11y-${tag}` })
    .select("id")
    .single();
  const { data: place } = await admin
    .from("places")
    .insert({ name: `[DEMO] Vereda ${tag}`, slug: `demo-vereda-a11y-${tag}`, kind: "vereda" })
    .select("id")
    .single();
  const { data: postCategory } = await admin
    .from("categories")
    .insert({ scope: "post", name: `[DEMO] Notas ${tag}`, slug: `demo-notas-a11y-${tag}` })
    .select("id")
    .single();
  const slugs = {
    activity: `demo-a11y-actividad-${tag}`,
    post: `demo-a11y-historia-${tag}`,
    project: `demo-a11y-proyecto-${tag}`,
    gallery: `demo-a11y-galeria-${tag}`,
  };
  const results = await Promise.all([
    admin.from("activities").insert({
      title: `[DEMO] Jornada accesible ${tag}`,
      slug: slugs.activity,
      starts_at: "2026-09-20T14:00:00Z",
      category_id: category!.id,
      place_id: place!.id,
      ...published,
    }),
    admin.from("posts").insert({
      title: `[DEMO] Historia accesible ${tag}`,
      slug: slugs.post,
      excerpt: "[DEMO] Una nota corta.",
      category_id: postCategory!.id,
      created_by: editor.id,
      ...published,
    }),
    admin.from("projects").insert({
      title: `[DEMO] Proyecto accesible ${tag}`,
      slug: slugs.project,
      summary: "[DEMO] Huertas para diez familias.",
      ...published,
    }),
  ]);
  for (const { error } of results) expect(error).toBeNull();

  const photo = await createTestPhoto(editor.id, {
    alt_text: `[DEMO] Huerta ${tag}`,
    people_in_photo: "none",
  });
  const { data: gallery, error: galleryError } = await admin
    .from("galleries")
    .insert({ title: `[DEMO] Galería accesible ${tag}`, slug: slugs.gallery, status: "review" })
    .select("id")
    .single();
  expect(galleryError).toBeNull();
  expect(
    (
      await admin
        .from("gallery_items")
        .insert({ gallery_id: gallery!.id, media_id: photo, position: 0 })
    ).error,
  ).toBeNull();
  // Published like in the app: by the editor, from the panel
  await signInEnrollingMfa(page, editor);
  await page.goto(`/admin/contenido/galerias/${gallery!.id}`);
  await page.getByRole("button", { name: "Publicar ahora" }).click();
  await expect(page.getByText(/Galería · Publicada/)).toBeVisible();

  const urls = [
    ...Object.entries(COVERED)
      .filter(([route, how]) => how === "public" && !route.includes("["))
      .map(([route]) => route),
    `/actividades/${slugs.activity}`,
    `/historias/${slugs.post}`,
    `/proyectos/${slugs.project}`,
    `/galeria/${slugs.gallery}`,
    "/buscar?q=jornada",
    "/esta-pagina-no-existe",
  ];
  for (const url of urls) {
    if (url === "/esta-pagina-no-existe") {
      await page.goto(url);
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(violations.map((violation) => `${url}: ${violation.id}`)).toEqual([]);
      continue;
    }
    await expectAccessible(page, url);
  }
});

test("the sign-in screens pass axe", async ({ page }) => {
  for (const url of ["/admin/login", "/admin/recuperar"]) await expectAccessible(page, url);
});

test("every section of the panel passes axe, editors included", async ({ page }) => {
  test.skip(!hasSupabase, "needs a local Supabase");
  test.setTimeout(300_000);
  const user = await createTestUser("admin");
  const admin = adminClient();
  const tag = randomUUID().slice(0, 6);
  const draft = (title: string) => ({ title: `[DEMO] ${title} ${tag}`, status: "draft" });

  const photo = await createTestPhoto(user.id, {
    alt_text: `[DEMO] Foto ${tag}`,
    people_in_photo: "none",
  });
  const consent = await createTestConsent(user.id, { subject_name: `[DEMO] Persona ${tag}` });
  const one = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await admin
      .from(table as "activities")
      .insert(row as never)
      .select("id")
      .single();
    expect(error, table).toBeNull();
    return data!.id as string;
  };
  const ids = {
    activity: await one("activities", {
      ...draft("Actividad"),
      slug: `demo-a11y-act-${tag}`,
      starts_at: "2026-09-20T14:00:00Z",
      created_by: user.id,
    }),
    post: await one("posts", {
      ...draft("Historia"),
      slug: `demo-a11y-post-${tag}`,
      created_by: user.id,
    }),
    project: await one("projects", { ...draft("Proyecto"), slug: `demo-a11y-proj-${tag}` }),
    gallery: await one("galleries", { ...draft("Galería"), slug: `demo-a11y-gal-${tag}` }),
    video: await one("videos", {
      ...draft("Video"),
      provider: "youtube",
      provider_video_id: `A11y${tag}xyz`,
    }),
    testimonial: await one("testimonials", {
      quote: `[DEMO] Testimonio ${tag}`,
      author_display_name: "[DEMO] Luz",
      consent_record_id: consent,
      status: "draft",
    }),
    team: await one("team_members", {
      full_name: `[DEMO] Integrante ${tag}`,
      role_title: "[DEMO] Voluntaria",
      consent_record_id: consent,
      status: "draft",
    }),
    message: await one("contact_messages", {
      full_name: `[DEMO] Vecina ${tag}`,
      email: `${tag}@example.test`,
      message: "[DEMO] Quiero ayudar.",
      privacy_policy_version: "1.0",
      consent_accepted_at: new Date().toISOString(),
    }),
  };
  const { data: pageRow } = await admin.from("pages").select("id").limit(1).single();

  await signInEnrollingMfa(page, user);
  const urls = [
    ...Object.entries(COVERED)
      .filter(([route, how]) => how === "panel" && !route.includes("["))
      .map(([route]) => route),
    `/admin/actividades/${ids.activity}/editar`,
    `/admin/actividades/${ids.activity}/listo`,
    `/admin/autorizaciones/${consent}`,
    `/admin/contenido/equipo/${ids.team}`,
    `/admin/contenido/galerias/${ids.gallery}`,
    `/admin/contenido/historias/${ids.post}`,
    `/admin/contenido/paginas/${pageRow!.id}`,
    `/admin/contenido/proyectos/${ids.project}`,
    `/admin/contenido/testimonios/${ids.testimonial}`,
    `/admin/contenido/videos/${ids.video}`,
    `/admin/medios/${photo}`,
    `/admin/mensajes/${ids.message}`,
  ];
  for (const url of urls) await expectAccessible(page, url);
});
