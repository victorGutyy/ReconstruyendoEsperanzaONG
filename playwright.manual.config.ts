import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Screenshots for the user manual (step 10.4): `npm run docs:manual` walks the
// panel on a phone with [DEMO] data and saves docs/manual/*.jpg. Not part of
// CI: run it again when the screens change.

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/manual",
  workers: 1,
  reporter: "list",
  timeout: 300_000,
  use: {
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
    baseURL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT} -H 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
