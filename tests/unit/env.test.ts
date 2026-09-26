import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readEnv } from "@/lib/env";

beforeEach(() => {
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://local:local@127.0.0.1:5432/bjj_test",
  );
  vi.stubEnv("BETTER_AUTH_URL", "http://127.0.0.1:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(32));
});
afterEach(() => vi.unstubAllEnvs());

describe("environment validation", () => {
  it.each(["postgres:", "postgresql:"])(
    "accepts PostgreSQL connection scheme %s and a 32-character secret",
    (scheme) => {
      vi.stubEnv(
        "DATABASE_URL",
        `${scheme}//local:local@127.0.0.1:5432/bjj_test`,
      );
      expect(readEnv()).toEqual({
        DATABASE_URL: `${scheme}//local:local@127.0.0.1:5432/bjj_test`,
        BETTER_AUTH_URL: "http://127.0.0.1:3000",
        BETTER_AUTH_SECRET: "a".repeat(32),
      });
    },
  );

  it.each([
    ["DATABASE_URL", "https://example.test/database"],
    ["DATABASE_URL", "mysql://127.0.0.1/bjj"],
    ["DATABASE_URL", "malformed"],
    ["BETTER_AUTH_URL", "not a url"],
    ["BETTER_AUTH_SECRET", "a".repeat(31)],
    ["BETTER_AUTH_SECRET", "replace-with-a-real-secret-of-32-characters"],
  ])(
    "identifies %s configuration errors without exposing values",
    (key, value) => {
      vi.stubEnv(key, value);
      expect(() => readEnv()).toThrow(
        `Invalid environment: ${key}. See .env.example.`,
      );
      try {
        readEnv();
      } catch (error) {
        expect((error as Error).message).not.toContain(value);
        expect((error as Error).message).not.toContain("local:local");
      }
    },
  );

  it("reports all absent required keys", () => {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("BETTER_AUTH_URL", undefined);
    vi.stubEnv("BETTER_AUTH_SECRET", undefined);
    expect(() => readEnv()).toThrow(
      "Invalid environment: DATABASE_URL, BETTER_AUTH_URL, BETTER_AUTH_SECRET. See .env.example.",
    );
  });
});
