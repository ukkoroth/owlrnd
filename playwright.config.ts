import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
  // Production build by default: no on-demand compiling or reloads mid-test. PW_DEV=1 uses the dev server instead.
  webServer: {
    command: process.env.PW_DEV ? "npm run dev" : "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Browser tests use the deterministic fake AI (no API calls, no cost).
    env: { OWLRND_DEV_PAGES: "1", OWLRND_FAKE_AI: "1" },
  },
});
