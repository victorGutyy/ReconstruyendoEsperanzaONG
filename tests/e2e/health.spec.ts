import { expect, test } from "@playwright/test";

// Health check (step 9.7): the uptime monitor reads it; it says only "ok".

test("the health check answers ok, never cached, with no data", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({ status: "ok" });
});
