import { expect, test } from "@playwright/test";

// Security headers (step 9.1, docs/05 §8): a fixed policy on the public site
// (pages stay cached), a strict one with a fresh nonce on every panel request.

const CSP = "content-security-policy-report-only";

test("the public site sends the security headers and a policy without nonce", async ({
  request,
}) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  expect(headers["strict-transport-security"]).toContain("max-age=63072000");
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(headers[CSP]).toContain("frame-ancestors 'none'");
  expect(headers[CSP]).toContain("https://challenges.cloudflare.com");
  expect(headers[CSP]).not.toContain("nonce-");
});

test("the panel gets its own strict policy, with a new nonce on every request", async ({
  page,
  request,
}) => {
  const response = await request.get("/admin/login");
  const csp = response.headers()[CSP] ?? "";
  const second = (await request.get("/admin/login")).headers()[CSP];
  expect(csp).toMatch(/script-src 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).not.toContain("'unsafe-inline' https://challenges");
  expect(csp).not.toBe(second);

  // Next puts that nonce on every script it sends; the ones they load later
  // are allowed by 'strict-dynamic'
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  const scripts = (await response.text()).match(/<script\b[^>]*>/g) ?? [];
  expect(scripts.length).toBeGreaterThan(0);
  for (const script of scripts) expect(script).toContain(`nonce="${nonce}"`);

  await page.goto("/admin/login");
  await expect(page.getByLabel("Correo")).toBeVisible();
});
