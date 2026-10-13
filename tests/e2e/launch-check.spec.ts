import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import {
  checkLaunch,
  findMarkers,
  robotsProblems,
  sitemapPaths,
} from "../../scripts/check-launch.mjs";
import { adminClient, hasSupabase } from "./helpers/users";

// The launch check (step 10.1): it must catch a placeholder left on the site.

test.describe.configure({ mode: "serial" });

test("markers are found with their context, wherever they are", () => {
  expect(
    findMarkers('<h1>[DEMO] Jornada de salud</h1><meta content="[PENDIENTE: texto]">'),
  ).toEqual(["[DEMO] Jornada de salud", "[PENDIENTE: texto]"]);
  expect(findMarkers("<p>Jornada de salud en la vereda</p>")).toEqual([]);
  expect(sitemapPaths("<loc>https://ejemplo.org/actividades/una</loc>")).toEqual([
    "/actividades/una",
  ]);
  expect(robotsProblems("User-Agent: *\nDisallow: /")).toContain(
    "robots.txt bloquea todo el sitio",
  );
});

test("a published [DEMO] activity stops the launch", async ({ baseURL, isMobile }) => {
  test.skip(isMobile || !hasSupabase, "one run is enough; needs a local Supabase");
  const admin = adminClient();
  const tag = randomUUID().slice(0, 6);
  const { data: place } = await admin
    .from("places")
    .insert({ name: `[DEMO] Vereda ${tag}`, slug: `demo-vereda-lanz-${tag}`, kind: "vereda" })
    .select("id")
    .single();
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "activity", name: `[DEMO] Salud ${tag}`, slug: `demo-salud-lanz-${tag}` })
    .select("id")
    .single();
  const slug = `demo-lanzamiento-${tag}`;
  const { error } = await admin.from("activities").insert({
    title: `[DEMO] Lanzamiento ${tag}`,
    slug,
    status: "published",
    published_at: new Date(Date.now() - 60_000).toISOString(),
    starts_at: "2026-09-20T14:00:00Z",
    place_id: place!.id,
    category_id: category!.id,
  });
  expect(error).toBeNull();

  const { problems } = await checkLaunch(baseURL!, {
    production: false,
    extraPages: [`/actividades/${slug}`],
  });
  expect(problems).toContainEqual({
    page: `/actividades/${slug}`,
    problem: `muestra [DEMO] Lanzamiento ${tag}`,
  });
});
