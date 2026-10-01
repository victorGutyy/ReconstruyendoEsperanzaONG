import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// The auth tests create [DEMO] users with the local Supabase secret key.
// Locally it comes from .env.local; in CI from the job environment.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Test-only value for the cron route (never the real one, which lives in Vercel)
process.env.CRON_SECRET ??= "e2e-cron-secret-for-local-and-ci-only";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "on-first-retry",
  },
  // Mobile first (docs/07 §1): the smallest supported phone width, then desktop
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Tests run against the production build, like the real site
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT} -H 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
