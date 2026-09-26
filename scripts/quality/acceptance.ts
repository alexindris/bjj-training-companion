import { cp, mkdtemp, rm, mkdir, realpath } from "node:fs/promises";
import { constants, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";
import { assertLocalSeed } from "../seed-guard";
import {
  startTestPostgres,
  testEnvironment,
} from "../../tests/support/postgres";

const root = resolve(import.meta.dirname, "../..");
await using postgres = await startTestPostgres("bjj_acceptance_test");
const testEnv = testEnvironment(postgres);
assertLocalSeed(testEnv);
const workspace = await realpath(
  await mkdtemp(join(tmpdir(), "bjj-acceptance-")),
);
const diagnostics = join(root, "reports", "acceptance");
console.log(
  `Disposable acceptance container: ${postgres.getId().slice(0, 12)}; workspace: ${workspace}`,
);

function run(script: string, environment: NodeJS.ProcessEnv) {
  const result = spawnSync("npm", ["run", script], {
    cwd: workspace,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${script} failed with exit status ${result.status ?? result.signal}.`,
    );
}

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Could not allocate a local acceptance port.");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

try {
  await rm(diagnostics, { recursive: true, force: true });
  const ignored = new Set([
    ".git",
    "node_modules",
    ".next",
    "coverage",
    "reports",
    ".stryker-tmp",
    "test-results",
    "playwright-report",
  ]);
  await cp(root, workspace, {
    recursive: true,
    filter: (source) => {
      const name = relative(root, source).split(/[\\/]/)[0];
      return (
        !ignored.has(name) &&
        (!name.startsWith(".env") || name === ".env.example")
      );
    },
  });
  await cp(join(root, "node_modules"), join(workspace, "node_modules"), {
    recursive: true,
    mode: constants.COPYFILE_FICLONE,
    verbatimSymlinks: true,
  });
  const port = await freePort();
  const origin = `http://localhost:${port}`;
  const environment: NodeJS.ProcessEnv = {
    ...testEnv,
    BETTER_AUTH_URL: origin,
    PLAYWRIGHT_BASE_URL: origin,
    BJJ_ACCEPTANCE_DATABASE: postgres.getDatabase(),
    E2E_PRODUCTION: "true",
    PORT: String(port),
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: "development",
  };
  run("db:migrate", environment);
  run("db:seed", environment);
  run("build", { ...environment, NODE_ENV: "production" });
  run("test:browser", environment);
  console.log(
    "PASS: isolated production build and browser acceptance. Development data and port 3000 were untouched.",
  );
} finally {
  try {
    if (existsSync(join(workspace, "test-results"))) {
      await mkdir(diagnostics, { recursive: true });
      await cp(
        join(workspace, "test-results"),
        join(diagnostics, "test-results"),
        { recursive: true },
      );
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
