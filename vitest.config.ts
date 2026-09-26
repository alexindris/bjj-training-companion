import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { coverageIncludes } from "./scripts/quality/coverage-scope.ts";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/quality/**/*.test.ts",
      "tests/mutation/**/*.test.ts",
    ],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: coverageIncludes,
      exclude: [],
      reporter: ["text", "json", "json-summary", "html"],
      reportsDirectory: "coverage",
      clean: true,
      thresholds: {
        perFile: true,
        statements: 90,
        lines: 90,
        branches: 90,
        functions: 100,
        autoUpdate: false,
      },
    },
  },
});
