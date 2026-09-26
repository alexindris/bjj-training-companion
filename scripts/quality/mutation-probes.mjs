import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { repository } from "./mutation-audit.mjs";

const probes = [
  {
    name: "remove-owner-predicate",
    original: ".where(eq(profiles.userId, session.user.id))",
    replacement: "",
  },
  {
    name: "forge-verified-session",
    original: "const session = await getSession();",
    replacement: 'const session = { user: { id: "verified-first" } };',
  },
];

function runTests(sandbox, name) {
  const output = resolve(sandbox, "probe-" + name + ".json");
  const result = spawnSync(
    process.execPath,
    [
      resolve(repository, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      "scripts/quality/mutation.vitest.config.ts",
      "--reporter=json",
      "--outputFile=" + output,
    ],
    { cwd: sandbox, encoding: "utf8" },
  );
  if (result.error) throw result.error;
  if (result.signal)
    throw new Error(name + ": probe process ended with " + result.signal);
  let report;
  try {
    report = JSON.parse(readFileSync(output, "utf8"));
  } catch {
    throw new Error(
      name + ": no test evidence; runner output: " + result.stderr,
    );
  }
  if (!report.numTotalTests || report.numRuntimeErrorTestSuites) {
    throw new Error(name + ": tests did not complete normally.");
  }
  return { result, report };
}

export function runBoundaryProbes() {
  mkdirSync(resolve(repository, ".stryker-tmp"), { recursive: true });
  const sandbox = mkdtempSync(resolve(repository, ".stryker-tmp/boundary-"));
  try {
    for (const path of [
      "src",
      "tests/unit",
      "scripts",
      "messages",
      "tsconfig.json",
      "vitest.config.ts",
      "stryker.config.mjs",
    ]) {
      cpSync(resolve(repository, path), resolve(sandbox, path), {
        recursive: true,
      });
    }
    symlinkSync(
      resolve(repository, "node_modules"),
      resolve(sandbox, "node_modules"),
      "dir",
    );
    const baseline = runTests(sandbox, "baseline");
    if (
      baseline.result.status !== 0 ||
      baseline.report.numFailedTests ||
      baseline.report.success !== true
    ) {
      throw new Error(
        "Boundary probe baseline failed. Repair the unmodified unit suite first.",
      );
    }
    const path = resolve(sandbox, "src/app/actions.ts");
    const source = readFileSync(path, "utf8");
    const summaries = [];
    for (const probe of probes) {
      if (source.split(probe.original).length !== 2) {
        throw new Error(
          probe.name + ": source boundary changed; review the probe.",
        );
      }
      writeFileSync(path, source.replace(probe.original, probe.replacement));
      const { result, report } = runTests(sandbox, probe.name);
      const failed = report.testResults.flatMap((suite) =>
        suite.assertionResults.filter((test) => test.status === "failed"),
      );
      if (
        result.status !== 1 ||
        !report.numFailedTests ||
        !failed.length ||
        !failed.every((test) =>
          test.failureMessages.some((message) =>
            message.includes("AssertionError"),
          ),
        )
      ) {
        throw new Error(
          probe.name +
            ": expected assertion failures did not detect the mutation.",
        );
      }
      summaries.push({
        name: probe.name,
        detected: true,
        failedAssertions: failed.map((test) => test.fullName),
      });
      console.log(
        "Boundary mutation detected: " +
          probe.name +
          " (" +
          failed.length +
          " assertion failures).",
      );
      writeFileSync(path, source);
    }
    const evidence = {
      baselineTests: baseline.report.numTotalTests,
      probes: summaries,
    };
    mkdirSync(resolve(repository, "reports/mutation"), { recursive: true });
    writeFileSync(
      resolve(repository, "reports/mutation/boundary-probes.json"),
      JSON.stringify(evidence, null, 2),
    );
    return evidence;
  } finally {
    // Only the fresh generated sandbox created above is removed.
    rmSync(sandbox, { recursive: true, force: true });
  }
}
