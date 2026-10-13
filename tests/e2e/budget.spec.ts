import { randomUUID } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

import { failOnCspViolations } from "./helpers/csp";
import { adminClient, hasSupabase, randomClientIp } from "./helpers/users";

failOnCspViolations();

// Performance budget (step 9.6, docs/07 §10): what a phone downloads on the
// first visit, compressed, measured on the production build. A page that
// grows past it fails here before anyone notices it on mobile data.

const KB = 1024;
const BUDGET = {
  script: 150 * KB,
  // Detail pages also carry sharing, the photo viewer and the videos (decision 9.6)
  detailScript: 160 * KB,
  font: 120 * KB,
  image: 200 * KB,
  total: 1024 * KB,
};

type Weight = {
  /** Our JavaScript requested before the page finished loading. */
  script: number;
  /** Code Next fetches afterwards for the links on screen (instant navigation). */
  prefetchedScript: number;
  font: number;
  largestImage: number;
  total: number;
  /** Turnstile on Contacto: Cloudflare's, loaded after the page on purpose. */
  thirdPartyScript: number;
};

async function firstVisit(page: Page, url: string, site: string): Promise<Weight> {
  const weight: Weight = {
    script: 0,
    prefetchedScript: 0,
    font: 0,
    largestImage: 0,
    total: 0,
    thirdPartyScript: 0,
  };
  const pending: Promise<void>[] = [];
  const beforeLoad = new Set<string>();
  let loaded = false;
  page.on("load", () => (loaded = true));
  page.on("request", (request) => {
    if (!loaded) beforeLoad.add(request.url());
  });
  page.on("requestfinished", (request) => {
    pending.push(
      request.sizes().then(({ responseBodySize }) => {
        weight.total += responseBodySize;
        const type = request.resourceType();
        const ours = new URL(request.url()).origin === new URL(site).origin;
        if (type === "script" && ours) {
          if (beforeLoad.has(request.url())) weight.script += responseBodySize;
          else weight.prefetchedScript += responseBodySize;
        }
        if (type === "script" && !ours) weight.thirdPartyScript += responseBodySize;
        if (type === "font") weight.font += responseBodySize;
        if (type === "image") weight.largestImage = Math.max(weight.largestImage, responseBodySize);
      }),
    );
  });
  await page.goto(url, { waitUntil: "load" });
  // Turnstile keeps a connection open on Contacto: wait for quiet, not forever
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await Promise.all(pending);
  return weight;
}

const kb = (bytes: number) => `${Math.round(bytes / KB)} KB`;

async function checkBudget(page: Page, url: string, site: string, scriptBudget = BUDGET.script) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
  const weight = await firstVisit(page, url, site);
  test.info().annotations.push({
    type: "weight",
    description: `JS ${kb(weight.script)} (+${kb(weight.prefetchedScript)} prefetch) · fonts ${kb(weight.font)} · largest image ${kb(weight.largestImage)} · total ${kb(weight.total)} · Turnstile ${kb(weight.thirdPartyScript)}`,
  });
  expect.soft(weight.script, `JavaScript on ${url}`).toBeLessThanOrEqual(scriptBudget);
  expect.soft(weight.font, `fonts on ${url}`).toBeLessThanOrEqual(BUDGET.font);
  expect.soft(weight.largestImage, `largest image on ${url}`).toBeLessThanOrEqual(BUDGET.image);
  expect.soft(weight.total, `first visit to ${url}`).toBeLessThanOrEqual(BUDGET.total);
}

for (const url of ["/", "/actividades", "/memoria", "/contacto"]) {
  test(`${url} stays within the budget`, async ({ page, baseURL }) => {
    await checkBudget(page, url, baseURL!);
  });
}

test("an activity page stays within the budget", async ({ page, baseURL }) => {
  test.skip(!hasSupabase, "needs a local Supabase");
  const admin = adminClient();
  const tag = randomUUID().slice(0, 6);
  const { data: place } = await admin
    .from("places")
    .insert({ name: `[DEMO] Vereda ${tag}`, slug: `demo-vereda-peso-${tag}`, kind: "vereda" })
    .select("id")
    .single();
  const { data: category } = await admin
    .from("categories")
    .insert({ scope: "activity", name: `[DEMO] Salud ${tag}`, slug: `demo-salud-peso-${tag}` })
    .select("id")
    .single();
  const slug = `demo-peso-${tag}`;
  const { error } = await admin.from("activities").insert({
    title: `[DEMO] Jornada liviana ${tag}`,
    slug,
    status: "published",
    published_at: new Date(Date.now() - 60_000).toISOString(),
    starts_at: "2026-09-20T14:00:00Z",
    place_id: place!.id,
    category_id: category!.id,
  });
  expect(error).toBeNull();
  await checkBudget(page, `/actividades/${slug}`, baseURL!, BUDGET.detailScript);
});
