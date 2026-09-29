import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { hashPassword } from "better-auth/crypto";
import { assertLocalSeed } from "./seed-guard";
import { startTestPostgres, testEnvironment } from "../tests/support/postgres";

async function migrateInitial(pool: Pool, count: number) {
  const folder = await mkdtemp(join(tmpdir(), "bjj-initial-migrations-"));
  try {
    await mkdir(join(folder, "meta"));
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    journal.entries = journal.entries.slice(0, count);
    await writeFile(
      join(folder, "meta/_journal.json"),
      JSON.stringify(journal),
    );
    for (const entry of journal.entries) {
      const tag = entry.tag as string;
      await writeFile(
        join(folder, `${tag}.sql`),
        await readFile(`drizzle/${tag}.sql`),
      );
    }
    await migrate(drizzle(pool), { migrationsFolder: folder });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

async function foundationSnapshot(pool: Pool) {
  const tables = [
    "users",
    "auth_accounts",
    "auth_sessions",
    "auth_verifications",
    "reference_positions",
  ];
  const records: Record<string, unknown> = {};
  for (const table of tables) {
    records[table] = (
      await pool.query(`SELECT * FROM ${table} ORDER BY id`)
    ).rows;
  }
  records.profiles = (
    await pool.query(
      "SELECT user_id,locale,timezone,training_mode FROM profiles ORDER BY user_id",
    )
  ).rows;
  return records;
}

async function verifyUpgrade() {
  await using postgres = await startTestPostgres("bjj_integration_test");
  const env = testEnvironment(postgres);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    await migrateInitial(pool, 1);
    await pool.query(
      "INSERT INTO users(id,name,email,email_verified) VALUES ('upgrade-owner','Upgrade fixture','upgrade@example.test',true)",
    );
    await pool.query(
      "INSERT INTO profiles(user_id,locale,timezone,training_mode) VALUES ('upgrade-owner','es','Europe/Madrid','no-gi')",
    );
    await pool.query(
      "INSERT INTO auth_accounts(id,account_id,provider_id,user_id,password) VALUES ('upgrade-account','upgrade-owner','credential','upgrade-owner',$1)",
      [await hashPassword(assertLocalSeed(env))],
    );
    await pool.query(
      "INSERT INTO auth_sessions(id,token,user_id,expires_at) VALUES ('upgrade-session','synthetic-upgrade-token','upgrade-owner',now()+interval '1 day')",
    );
    await pool.query(
      "INSERT INTO auth_verifications(id,identifier,value,expires_at) VALUES ('upgrade-verification','synthetic-identifier','synthetic-value',now()+interval '1 day')",
    );
    await pool.query(
      "INSERT INTO reference_positions(id,title,description,provenance) VALUES ('upgrade-position','Original English fixture','Preserved fixture text','Synthetic integration fixture')",
    );
    const original = await foundationSnapshot(pool);
    execFileSync("npm", ["run", "db:migrate"], { env, stdio: "pipe" });
    assert.deepEqual(await foundationSnapshot(pool), original);
    assert.deepEqual(
      (await pool.query("SELECT active_goal_id FROM profiles")).rows,
      [{ active_goal_id: null }],
    );
    assert.deepEqual(
      (
        await pool.query(
          "SELECT (SELECT count(*)::int FROM goals) AS goals,(SELECT count(*)::int FROM training_sessions) AS classes,(SELECT count(*)::int FROM goal_observations) AS observations",
        )
      ).rows[0],
      { goals: 0, classes: 0, observations: 0 },
    );
    console.log(
      "PASS: additive upgrade preserves authentication, profile defaults and English reference rows; training collections start empty.",
    );
  } finally {
    await pool.end();
  }
}

async function tableSnapshot(pool: Pool, tables: string[]) {
  const snapshot: Record<string, unknown> = {};
  for (const table of tables) {
    snapshot[table] = (
      await pool.query(`SELECT * FROM ${table} ORDER BY id`)
    ).rows;
  }
  snapshot.profiles = (
    await pool.query("SELECT * FROM profiles ORDER BY user_id")
  ).rows;
  return snapshot;
}

async function verifyMilestoneTwoUpgrade() {
  await using postgres = await startTestPostgres("bjj_integration_test");
  const env = testEnvironment(postgres);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    await migrateInitial(pool, 2);
    await pool.query(
      "INSERT INTO users(id,name,email,email_verified) VALUES ('m2-owner','Upgrade fixture','m2@example.test',true)",
    );
    await pool.query(
      "INSERT INTO profiles(user_id,locale,timezone,training_mode) VALUES ('m2-owner','es','Europe/Madrid','no-gi')",
    );
    await pool.query(
      "INSERT INTO auth_accounts(id,account_id,provider_id,user_id,password) VALUES ('m2-account','m2-owner','credential','m2-owner',$1)",
      [await hashPassword(assertLocalSeed(env))],
    );
    await pool.query(
      "INSERT INTO auth_sessions(id,token,user_id,expires_at) VALUES ('m2-session','synthetic-m2-token','m2-owner',now()+interval '1 day')",
    );
    await pool.query(
      "INSERT INTO auth_verifications(id,identifier,value,expires_at) VALUES ('m2-verification','synthetic-m2-identifier','synthetic-value',now()+interval '1 day')",
    );
    await pool.query(
      "INSERT INTO reference_positions(id,title,description,provenance) VALUES ('closed-guard','Customized original','Preserve exactly','Synthetic upgrade fixture')",
    );
    await pool.query(
      "INSERT INTO goals(id,user_id,title,notes) VALUES ('m2-active','m2-owner','Active focus','Keep note'),('m2-inactive','m2-owner','Other goal',null)",
    );
    await pool.query(
      "UPDATE profiles SET active_goal_id='m2-active' WHERE user_id='m2-owner'",
    );
    await pool.query(
      "INSERT INTO training_sessions(id,user_id,submission_id,training_date,training_mode,class_technique) VALUES ('m2-class-linked','m2-owner','11111111-1111-4111-8111-111111111111','2026-09-27','no-gi','Arm drag'),('m2-class-general','m2-owner','22222222-2222-4222-8222-222222222222','2026-09-28','gi','Guard retention')",
    );
    await pool.query(
      "INSERT INTO goal_observations(id,user_id,class_id,goal_id,outcome,opportunities,attempts,successes,obstacle,next_cue) VALUES ('m2-observation','m2-owner','m2-class-linked','m2-active','tried',0,0,null,'Keep posture','Try again')",
    );
    const tables = [
      "users",
      "auth_accounts",
      "auth_sessions",
      "auth_verifications",
      "reference_positions",
      "goals",
      "training_sessions",
      "goal_observations",
    ];
    const before = await tableSnapshot(pool, tables);
    execFileSync("npm", ["run", "db:migrate"], { env, stdio: "pipe" });
    assert.deepEqual(await tableSnapshot(pool, tables), before);
    assert.deepEqual(
      (
        await pool.query(
          "SELECT (SELECT count(*)::int FROM reference_techniques) AS techniques,(SELECT count(*)::int FROM reference_videos) AS videos,(SELECT count(*)::int FROM reference_notes) AS notes",
        )
      ).rows[0],
      { techniques: 0, videos: 0, notes: 0 },
    );
    console.log(
      "PASS: milestone-2-to-3 upgrade preserves owned training, preferences, auth and customized shared rows.",
    );
  } finally {
    await pool.end();
  }
}

async function verifyFresh() {
  await using postgres = await startTestPostgres("bjj_integration_test");
  const childEnv = testEnvironment(postgres);
  const password = assertLocalSeed(childEnv);
  const temporary = new Pool({ connectionString: childEnv.DATABASE_URL });
  try {
    const run = (script: string) =>
      execFileSync("npm", ["run", script], { env: childEnv, stdio: "pipe" });
    run("db:migrate");
    run("db:migrate");
    run("db:seed");
    await temporary.query(
      "UPDATE profiles SET locale = 'es' FROM users u WHERE profiles.user_id=u.id AND u.email='sam@example.test'",
    );
    run("db:seed");
    const counts = await temporary.query(
      "SELECT (SELECT count(*)::int FROM users) AS users, (SELECT count(*)::int FROM profiles) AS profiles, (SELECT count(*)::int FROM auth_accounts) AS accounts, (SELECT count(*)::int FROM reference_positions) AS positions, (SELECT count(*)::int FROM reference_techniques) AS techniques, (SELECT count(*)::int FROM reference_videos) AS videos, (SELECT count(*)::int FROM reference_notes) AS notes",
    );
    assert.deepEqual(counts.rows[0], {
      users: 2,
      profiles: 2,
      accounts: 2,
      positions: 4,
      techniques: 4,
      videos: 2,
      notes: 0,
    });
    const stored = await temporary.query(
      "SELECT bool_and(password IS NOT NULL AND password <> $1) AS hashed FROM auth_accounts",
      [password],
    );
    assert.equal(stored.rows[0].hashed, true);
    const preference = await temporary.query(
      "SELECT p.locale,p.active_goal_id FROM profiles p JOIN users u ON p.user_id=u.id WHERE u.email='sam@example.test'",
    );
    assert.deepEqual(preference.rows[0], {
      locale: "es",
      active_goal_id: null,
    });
    await assert.rejects(
      temporary.query("UPDATE profiles SET locale='fr'"),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "23514",
    );
    execFileSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "tests/support/training-database.ts",
      ],
      { env: childEnv, stdio: "inherit" },
    );
    execFileSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "tests/support/reference-database.ts",
      ],
      { env: childEnv, stdio: "inherit" },
    );
    console.log(
      "PASS: fresh migrations, migration/seed reruns, hashed credentials, preserved preferences and locale constraints.",
    );
  } finally {
    await temporary.end();
  }
}

await verifyUpgrade();
await verifyMilestoneTwoUpgrade();
await verifyFresh();
