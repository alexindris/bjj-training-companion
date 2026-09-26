import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      process.env.E2E_PRODUCTION === "true" ? "npm start" : "npm run dev",
    url: "http://localhost:3000/en/sign-in",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
