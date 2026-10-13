import { defineConfig, devices } from "@playwright/test";

// Production smoke test (step 10.2): read-only checks against a deployed site,
// after each production deploy. It never signs in, writes or deletes.
//
//   SMOKE_URL=https://<dominio> npm run test:smoke
//   SMOKE_URL=http://127.0.0.1:3100 SMOKE_NOT_PRODUCTION=1 npm run test:smoke

const baseURL = process.env.SMOKE_URL;
if (!baseURL) throw new Error("SMOKE_URL is required: the address of the site to check");

export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: true,
  retries: 1,
  reporter: "list",
  use: { baseURL, locale: "es-CO", timezoneId: "America/Bogota" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
