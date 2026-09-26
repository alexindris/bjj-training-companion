import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { sourceHashes } from "./coverage-scope";
import { analyzeFile, coverageReportSchema } from "./crap-analysis";

export async function verifyApplicationCoverage(
  root: string,
  sources: string[],
  rawReport: unknown,
) {
  const report = coverageReportSchema.parse(rawReport);
  for (const file of sources) {
    const absolute = path.join(root, file);
    if (!report[absolute]) {
      throw new Error(`Coverage report omitted measured source: ${file}`);
    }
    analyzeFile(await readFile(absolute, "utf8"), file, report[absolute]);
  }
}

export async function freshCoverage(root = process.cwd()) {
  const before = await sourceHashes(root);
  await rm(path.join(root, "coverage"), { recursive: true, force: true });
  const run = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "--coverage"],
    {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    },
  );
  if (run.error) throw run.error;
  if (run.status !== 0)
    throw new Error(
      `Coverage tests/thresholds failed (exit ${run.status ?? "signal"}).`,
    );
  const after = await sourceHashes(root);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(
      "Application sources changed during coverage. Rerun with a stable working tree.",
    );
  }
  const report = await readFile(
    path.join(root, "coverage/coverage-final.json"),
  );
  await verifyApplicationCoverage(
    root,
    Object.keys(before),
    JSON.parse(report.toString("utf8")),
  );
  await writeFile(
    path.join(root, "coverage/provenance.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sources: before,
        reportHash: createHash("sha256").update(report).digest("hex"),
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  await freshCoverage();
}
