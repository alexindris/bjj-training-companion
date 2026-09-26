import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/quality/fixtures/mapping.spec.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["tests/quality/fixtures/mapping.ts"],
      reporter: ["json"],
    },
  },
});
