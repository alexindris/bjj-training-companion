import "dotenv/config";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { assertLocalSeed } from "./seed-guard";

// Creates and drops only its own disposable database on the guarded local server.
const password = assertLocalSeed(process.env);
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
const name = `bjj_verify_${randomBytes(6).toString("hex")}`;
const url = new URL(process.env.DATABASE_URL!);
url.pathname = `/${name}`;
const childEnv = { ...process.env, DATABASE_URL: url.toString() };
let created = false;
let temporary: Pool | undefined;
try {
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  const run = (script: string) =>
    execFileSync("npm", ["run", script], { env: childEnv, stdio: "pipe" });
  run("db:migrate");
  run("db:migrate");
  run("db:seed");
  temporary = new Pool({ connectionString: url.toString() });
  await temporary.query(
    "UPDATE profiles SET locale = 'es' FROM users u WHERE profiles.user_id=u.id AND u.email='sam@example.test'",
  );
  run("db:seed");
  const counts = await temporary.query(
    "SELECT (SELECT count(*)::int FROM users) AS users, (SELECT count(*)::int FROM profiles) AS profiles, (SELECT count(*)::int FROM auth_accounts) AS accounts, (SELECT count(*)::int FROM reference_positions) AS positions",
  );
  assert.deepEqual(counts.rows[0], {
    users: 2,
    profiles: 2,
    accounts: 2,
    positions: 4,
  });
  const stored = await temporary.query(
    "SELECT bool_and(password IS NOT NULL AND password <> $1) AS hashed FROM auth_accounts",
    [password],
  );
  assert.equal(stored.rows[0].hashed, true);
  const preference = await temporary.query(
    "SELECT p.locale FROM profiles p JOIN users u ON p.user_id=u.id WHERE u.email='sam@example.test'",
  );
  assert.equal(preference.rows[0].locale, "es");
  await assert.rejects(
    temporary.query("UPDATE profiles SET locale='fr'"),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "23514",
  );
  console.log(
    "PASS: fresh migrations, migration rerun, seed rerun, hashed credentials, preserved preferences, and database locale constraint.",
  );
} finally {
  await temporary?.end();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
}
