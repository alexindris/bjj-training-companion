import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  auditCurrentMutationReport,
  mutationFingerprint,
  reportHash,
  repository,
} from "./mutation-audit.mjs";
import { runBoundaryProbes } from "./mutation-probes.mjs";

const fingerprint = mutationFingerprint();
// This path is fixed and contains generated reports only, never database data.
rmSync(resolve(repository, "reports/mutation"), {
  recursive: true,
  force: true,
});
const result = spawnSync(
  process.execPath,
  [
    resolve(repository, "node_modules/@stryker-mutator/core/bin/stryker.js"),
    "run",
  ],
  { cwd: repository, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
runBoundaryProbes();
if (fingerprint !== mutationFingerprint()) {
  throw new Error(
    "Inputs changed during mutation testing. Rerun against stable sources.",
  );
}
const raw = readFileSync(resolve(repository, "reports/mutation/mutation.json"));
const probeRaw = readFileSync(
  resolve(repository, "reports/mutation/boundary-probes.json"),
);
writeFileSync(
  resolve(repository, "reports/mutation/evidence.json"),
  JSON.stringify(
    {
      fingerprint,
      reportHash: reportHash(raw),
      probeHash: reportHash(probeRaw),
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
auditCurrentMutationReport();
