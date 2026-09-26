import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
    "reports/**",
    ".stryker-tmp/**",
  ]),
  {
    files: ["src/**/*.{ts,tsx}", "scripts/seed-guard.ts"],
    rules: {
      complexity: ["error", { max: 15, variant: "classic" }],
      "max-depth": ["error", 4],
      "max-params": ["error", 4],
    },
  },
]);
