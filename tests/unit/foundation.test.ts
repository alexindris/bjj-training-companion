import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { assertLocalSeed } from "../../scripts/seed-guard";
import { cn } from "@/lib/utils";

function translationLeaves(
  object: object,
  prefix = "",
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(object).flatMap(([key, value]) =>
      typeof value === "string"
        ? [[`${prefix}${key}`, value]]
        : Object.entries(translationLeaves(value, `${prefix}${key}.`)),
    ),
  );
}

describe("UI localization contract", () => {
  it("offers the same translation keys and interpolation values in both languages", () => {
    const english = translationLeaves(en);
    const spanish = translationLeaves(es);
    expect(Object.keys(english).sort()).toEqual(Object.keys(spanish).sort());
    for (const key of Object.keys(english)) {
      expect(spanish[key]?.match(/\{[^}]+\}/g), key).toEqual(
        english[key]?.match(/\{[^}]+\}/g),
      );
    }
  });
});

describe("safe synthetic seeding", () => {
  const local = {
    ALLOW_DEV_SEED: "true",
    DATABASE_URL: "postgresql://dev:dev@localhost:5432/bjj",
    DEV_USER_PASSWORD: "synthetic-test-password",
  };

  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "accepts an explicitly enabled loopback database: %s",
    (host) => {
      expect(
        assertLocalSeed({
          ...local,
          DATABASE_URL: `postgresql://dev:dev@${host}:5432/bjj`,
        }),
      ).toBe(local.DEV_USER_PASSWORD);
    },
  );

  it.each([
    { NODE_ENV: "production" },
    { ALLOW_DEV_SEED: "false" },
    { ALLOW_DEV_SEED: undefined },
  ])("requires explicit local development permission: %j", (overrides) => {
    expect(() => assertLocalSeed({ ...local, ...overrides })).toThrow(
      "Development seeding requires ALLOW_DEV_SEED=true and a non-production environment.",
    );
  });

  it.each([
    "postgresql://dev:dev@remote.example.test/bjj",
    "postgresql://dev:dev@localhost.example.test/bjj",
  ])("rejects non-loopback storage: %s", (url) => {
    expect(() => assertLocalSeed({ ...local, DATABASE_URL: url })).toThrow(
      "restricted to a loopback",
    );
  });

  it.each([undefined, "", "not a URL"])(
    "rejects absent or malformed database URL: %s",
    (url) => {
      expect(() => assertLocalSeed({ ...local, DATABASE_URL: url })).toThrow();
    },
  );

  it.each([
    undefined,
    "x".repeat(11),
    "x".repeat(129),
    "replace-with-a-local-password",
  ])("rejects unsafe synthetic passwords", (password) => {
    expect(() =>
      assertLocalSeed({ ...local, DEV_USER_PASSWORD: password }),
    ).toThrow("12–128 characters");
  });

  it.each([12, 128])(
    "accepts the documented password boundary of %i",
    (length) => {
      expect(
        assertLocalSeed({ ...local, DEV_USER_PASSWORD: "x".repeat(length) }),
      ).toBe("x".repeat(length));
    },
  );
});

describe("shared class composition", () => {
  it("keeps conditional classes and lets the last conflicting utility win", () => {
    expect(
      cn(
        "px-2 text-sm",
        { hidden: false, block: true },
        ["px-4", null],
        undefined,
      ),
    ).toBe("text-sm block px-4");
    expect(cn()).toBe("");
  });
});
