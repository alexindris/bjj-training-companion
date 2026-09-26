import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { freshCoverage } from "./coverage";
import { sourceHashes } from "./coverage-scope";
import { analyzeFile, coverageReportSchema } from "./crap-analysis";

const threshold = 15;
const root = process.cwd();
const advisory = process.argv.includes("--advisory");
await freshCoverage(root);
const reportFile = path.join(root, "coverage/coverage-final.json");
const reportText = await readFile(reportFile, "utf8");
const provenance = z
  .object({ sources: z.record(z.string(), z.string()), reportHash: z.string() })
  .parse(
    JSON.parse(
      await readFile(path.join(root, "coverage/provenance.json"), "utf8"),
    ),
  );
if (
  createHash("sha256").update(reportText).digest("hex") !==
    provenance.reportHash ||
  JSON.stringify(await sourceHashes(root)) !==
    JSON.stringify(provenance.sources)
) {
  throw new Error(
    "Coverage provenance does not match current application sources/report.",
  );
}
const coverage = coverageReportSchema.parse(JSON.parse(reportText));
const rows = [];
for (const file of Object.keys(provenance.sources)) {
  const absolute = path.join(root, file);
  if (!coverage[absolute])
    throw new Error(`Coverage report omitted measured source: ${file}`);
  const source = await readFile(absolute, "utf8");
  for (const fn of analyzeFile(source, file, coverage[absolute])) {
    rows.push({
      file,
      line: fn.body.start.line,
      name: fn.name,
      complexity: fn.complexity,
      coverage: fn.coverage,
      crap: fn.crap,
    });
  }
}
if (!rows.length) throw new Error("No application functions were measured.");
rows.sort((a, b) => b.crap - a.crap);
console.table(
  rows.map((row) => ({
    ...row,
    coverage: `${(row.coverage * 100).toFixed(1)}%`,
    crap: row.crap.toFixed(3),
  })),
);
await writeFile(
  path.join(root, "coverage/crap.json"),
  JSON.stringify({ advisory, threshold, rows }, null, 2),
);
const failures = rows.filter((row) => row.crap > threshold);
console.log(
  `${advisory ? "Advisory" : "Enforced"} CRAP <= ${threshold}: ${rows.length} functions; ${failures.length} exceed threshold.`,
);
if (!advisory && failures.length) process.exitCode = 1;
