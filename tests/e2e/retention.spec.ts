import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { failOnCspViolations } from "./helpers/csp";
import { adminClient, createTestUser, hasSupabase } from "./helpers/users";

failOnCspViolations();

// Daily retention (step 9.3, docs/09 §3): messages after 12 months, uploads
// left halfway, only with the secret, counts only.

const url = "/api/cron/cleanup";
const ago = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

test("the daily cleanup only runs with the secret", async ({ request }) => {
  expect((await request.get(url)).status()).toBe(401);
  expect(
    (await request.get(url, { headers: { authorization: "Bearer not-the-secret" } })).status(),
  ).toBe(401);
});

test("old messages and stalled uploads go; recent ones stay", async ({ request }) => {
  test.skip(!hasSupabase, "needs a local Supabase");
  const admin = adminClient();
  const author = await createTestUser("author");
  const tag = randomUUID().slice(0, 8);
  const message = (name: string, handledHoursAgo: number | null, createdHoursAgo: number) => ({
    id: randomUUID(),
    full_name: `[DEMO] ${name} ${tag}`,
    email: `${tag}@example.test`,
    message: "[DEMO] Mensaje de prueba",
    privacy_policy_version: "1.0",
    consent_accepted_at: ago(createdHoursAgo),
    status: handledHoursAgo === null ? "new" : "handled",
    handled_at: handledHoursAgo === null ? null : ago(handledHoursAgo),
    created_at: ago(createdHoursAgo),
  });
  const year = 365 * 24;
  const oldHandled = message("Viejo", 13 * 30 * 24, 2 * year);
  const recent = message("Reciente", 24, 2 * year);
  const media = (status: "processing" | "failed", hoursAgo: number) => ({
    id: randomUUID(),
    processing_status: status,
    uploaded_by: author.id,
    created_at: ago(hoursAgo),
  });
  const stalled = media("processing", 30);
  const uploading = media("processing", 1);
  const failedLastWeek = media("failed", 8 * 24);
  const failedYesterday = media("failed", 30);

  expect((await admin.from("contact_messages").insert([oldHandled, recent])).error).toBeNull();
  expect(
    (await admin.from("media").insert([stalled, uploading, failedLastWeek, failedYesterday])).error,
  ).toBeNull();

  const response = await request.get(url, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(["audit", "messages", "uploads"]);
  expect(body.messages).toBeGreaterThanOrEqual(1);
  expect(body.uploads).toBeGreaterThanOrEqual(2);

  const { data: messages } = await admin
    .from("contact_messages")
    .select("id")
    .in("id", [oldHandled.id, recent.id]);
  expect(messages?.map((row) => row.id)).toEqual([recent.id]);

  const { data: photos } = await admin
    .from("media")
    .select("id, deleted_at")
    .in("id", [stalled.id, uploading.id, failedLastWeek.id, failedYesterday.id]);
  const withdrawn = (id: string) => photos?.find((row) => row.id === id)?.deleted_at !== null;
  expect(withdrawn(stalled.id)).toBe(true);
  expect(withdrawn(failedLastWeek.id)).toBe(true);
  expect(withdrawn(uploading.id)).toBe(false);
  expect(withdrawn(failedYesterday.id)).toBe(false);
});
