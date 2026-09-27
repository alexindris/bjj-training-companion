/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  mutate: [
    "src/app/actions.ts",
    "src/app/training-actions.ts",
    "src/lib/training-validation.ts",
    "src/lib/training-store.ts",
    "src/lib/env.ts",
    "src/lib/session.ts",
    "scripts/seed-guard.ts",
  ],
  // A fresh full unit run avoids upstream Vitest per-test pairing problems.
  testRunner: "command",
  commandRunner: {
    command:
      "node node_modules/vitest/vitest.mjs run --config scripts/quality/mutation.vitest.config.ts",
  },
  checkers: ["typescript"],
  tsconfigFile: "scripts/quality/mutation.tsconfig.json",
  typescriptChecker: { prioritizePerformanceOverAccuracy: false },
  concurrency: 2,
  coverageAnalysis: "off",
  incremental: false,
  timeoutMS: 5000,
  thresholds: { high: 95, low: 90, break: 90 },
  reporters: ["progress", "clear-text", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  // Nothing under these paths is needed for the isolated unit test sandbox.
  // Keep local credentials and generated outputs out of the copied sandbox.
  ignorePatterns: [
    ".env*",
    ".next",
    "coverage",
    "reports",
    "playwright-report",
    "test-results",
  ],
};

export default config;
