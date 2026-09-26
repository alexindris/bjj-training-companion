import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      process.env.E2E_PRODUCTION === "true" ? "npm start" : "npm run dev",
    url: `${baseURL}/en/sign-in`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
