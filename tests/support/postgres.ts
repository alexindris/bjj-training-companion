import { randomBytes } from "node:crypto";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

export function startTestPostgres(
  database: "bjj_integration_test" | "bjj_acceptance_test",
) {
  return new PostgreSqlContainer("postgres:17.9-alpine")
    .withDatabase(database)
    .withUsername("bjj_test")
    .withPassword(randomBytes(24).toString("hex"))
    .withLabels({ "bjj.test-suite": database })
    .start();
}

export function testEnvironment(
  postgres: StartedPostgreSqlContainer,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: postgres.getConnectionUri(),
    BETTER_AUTH_URL: "http://localhost:3000",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    DEV_USER_PASSWORD: randomBytes(24).toString("hex"),
    ALLOW_DEV_SEED: "true",
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
    // Child migration/seed commands must not load development .env files.
    DOTENV_CONFIG_PATH: process.platform === "win32" ? "NUL" : "/dev/null",
  };
}
