import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import config from "../../stryker.config.mjs";

export const repository = fileURLToPath(new URL("../../", import.meta.url));

function filesWithin(directory) {
  return readdirSync(resolve(repository, directory), { withFileTypes: true })
    .flatMap((entry) => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? filesWithin(path) : [path];
    })
    .sort();
}

export function mutationFingerprint() {
  const files = [
    ...filesWithin("src"),
    ...filesWithin("tests/unit"),
    ...filesWithin("messages"),
    "scripts/seed-guard.ts",
    "scripts/quality/mutation.mjs",
    "scripts/quality/mutation-audit.mjs",
    "scripts/quality/mutation-audit.d.mts",
    "scripts/quality/mutation-probes.mjs",
    "scripts/quality/mutation-equivalents.json",
    "scripts/quality/mutation.tsconfig.json",
    "scripts/quality/mutation.vitest.config.ts",
    "stryker.config.mjs",
    "stryker.config.d.mts",
    "vitest.config.ts",
    "scripts/quality/coverage-scope.ts",
    "tsconfig.json",
    "package-lock.json",
    "package.json",
  ];
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash
      .update(file)
      .update("\0")
      .update(readFileSync(resolve(repository, file)));
  }
  return hash.digest("hex");
}

export function reportHash(content) {
  return createHash("sha256").update(content).digest("hex");
}

function sourceAt(source, location) {
  const lines = source.split("\n");
  // Mutation Testing Report positions use one-based lines and columns.
  const index = ({ line, column }) =>
    lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0) +
    column -
    1;
  return source.slice(index(location.start), index(location.end));
}

export function auditMutationReport(report, equivalents) {
  if (!report.files || !Object.keys(report.files).length) {
    throw new Error("Missing mutation files: an empty report cannot pass.");
  }
  const seen = new Set();
  const statuses = {};
  for (const file of config.mutate) {
    const entry = report.files[file];
    if (!entry?.mutants?.length) {
      throw new Error(`Missing mutation evidence for ${file}.`);
    }
    const source = readFileSync(resolve(repository, file), "utf8");
    if (entry.source !== source) {
      throw new Error(
        `Stale mutation source for ${file}. Rerun mutation testing.`,
      );
    }
    for (const mutant of entry.mutants) {
      statuses[mutant.status] = (statuses[mutant.status] ?? 0) + 1;
      if (["Killed", "Timeout", "CompileError"].includes(mutant.status))
        continue;
      if (mutant.status !== "Survived") {
        throw new Error(
          `${file}:${mutant.location.start.line}: ${mutant.status} mutation evidence cannot pass.`,
        );
      }
      const original = sourceAt(source, mutant.location);
      const index = equivalents.findIndex(
        (exception) =>
          exception.file === file &&
          exception.mutator === mutant.mutatorName &&
          JSON.stringify(exception.location) ===
            JSON.stringify(mutant.location) &&
          exception.original === original &&
          exception.replacement === mutant.replacement &&
          exception.reason?.trim(),
      );
      if (index < 0) {
        throw new Error(
          `${file}:${mutant.location.start.line}: unreviewed ${mutant.mutatorName} survivor (${original} → ${mutant.replacement}).`,
        );
      }
      seen.add(index);
    }
  }
  if (seen.size !== equivalents.length) {
    throw new Error(
      "Stale or duplicate equivalent-mutant entries require review.",
    );
  }
  return statuses;
}

export function auditCurrentMutationReport() {
  const raw = readFileSync(
    resolve(repository, "reports/mutation/mutation.json"),
  );
  const evidence = JSON.parse(
    readFileSync(resolve(repository, "reports/mutation/evidence.json"), "utf8"),
  );
  const probeRaw = readFileSync(
    resolve(repository, "reports/mutation/boundary-probes.json"),
  );
  const probes = JSON.parse(probeRaw.toString());
  if (
    evidence.fingerprint !== mutationFingerprint() ||
    evidence.reportHash !== reportHash(raw) ||
    evidence.probeHash !== reportHash(probeRaw)
  ) {
    throw new Error(
      "Mutation evidence is stale or altered. Run npm run test:mutation.",
    );
  }
  if (
    !probes.baselineTests ||
    probes.probes?.length !== 2 ||
    probes.probes.some(
      (probe) => !probe.detected || !probe.failedAssertions?.length,
    )
  ) {
    throw new Error("Missing detected ownership/session mutation probes.");
  }
  const equivalents = JSON.parse(
    readFileSync(
      resolve(repository, "scripts/quality/mutation-equivalents.json"),
      "utf8",
    ),
  );
  const statuses = auditMutationReport(JSON.parse(raw.toString()), equivalents);
  console.log(`Mutation audit passed: ${JSON.stringify(statuses)}`);
  return statuses;
}

if (
  process.argv[1] &&
  relative(repository, resolve(process.argv[1])) ===
    "scripts/quality/mutation-audit.mjs"
) {
  auditCurrentMutationReport();
}
