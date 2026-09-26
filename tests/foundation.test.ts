import { test } from "node:test";
import assert from "node:assert/strict";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { assertLocalSeed } from "../scripts/seed-guard";

test("Spanish and English expose the same UI translation keys and placeholders", () => {
  const keys = (object: object, prefix = ""): Record<string, string> =>
    Object.fromEntries(
      Object.entries(object).flatMap(([key, value]) =>
        typeof value === "string"
          ? [[`${prefix}${key}`, value]]
          : Object.entries(keys(value, `${prefix}${key}.`)),
      ),
    );
  const english = keys(en);
  const spanish = keys(es);
  assert.deepEqual(Object.keys(english).sort(), Object.keys(spanish).sort());
  for (const key of Object.keys(english)) {
    assert.deepEqual(
      english[key].match(/\{[^}]+\}/g),
      spanish[key].match(/\{[^}]+\}/g),
      key,
    );
  }
});

test("synthetic credentials cannot be seeded into production or a remote database", () => {
  const env = {
    ALLOW_DEV_SEED: "true",
    DATABASE_URL: "postgresql://dev:dev@localhost:5432/bjj",
    DEV_USER_PASSWORD: "synthetic-test-password",
  };
  assert.equal(assertLocalSeed(env), env.DEV_USER_PASSWORD);
  assert.throws(() => assertLocalSeed({ ...env, NODE_ENV: "production" }));
  assert.throws(() => assertLocalSeed({ ...env, ALLOW_DEV_SEED: "false" }));
  assert.throws(() =>
    assertLocalSeed({
      ...env,
      DATABASE_URL: "postgresql://dev:dev@db.example.com/bjj",
    }),
  );
  assert.throws(() =>
    assertLocalSeed({
      ...env,
      DEV_USER_PASSWORD: "replace-with-a-local-development-password",
    }),
  );
});
