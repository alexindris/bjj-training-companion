import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  auditMutationReport,
  repository,
  type MutationReport,
} from "../../scripts/quality/mutation-audit.mjs";
import config from "../../stryker.config.mjs";

function fixture(): MutationReport {
  return {
    files: Object.fromEntries(
      config.mutate.map((file) => [
        file,
        {
          source: readFileSync(resolve(repository, file), "utf8"),
          mutants: [
            {
              status: "Killed",
              mutatorName: "StringLiteral",
              replacement: '""',
              location: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 13 },
              },
            },
          ],
        },
      ]),
    ),
  };
}

describe("mutation evidence gate", () => {
  test("accepts killed evidence for all targets; rejects empty, missing, or stale evidence", () => {
    expect(auditMutationReport(fixture(), [])).toEqual({
      Killed: config.mutate.length,
    });
    expect(() => auditMutationReport({ files: {} }, [])).toThrow(/empty/);
    const missing = fixture();
    delete missing.files["src/app/actions.ts"];
    expect(() => auditMutationReport(missing, [])).toThrow(/Missing/);
    const stale = fixture();
    stale.files["src/app/actions.ts"]!.source += "\n";
    expect(() => auditMutationReport(stale, [])).toThrow(/Stale/);
  });

  test.each(["NoCoverage", "RuntimeError", "Ignored"])(
    "%s cannot silently pass",
    (status) => {
      const report = fixture();
      report.files["src/app/actions.ts"]!.mutants[0]!.status = status;
      expect(() => auditMutationReport(report, [])).toThrow(status);
    },
  );

  test("a survivor maps one-based Stryker columns to an exact quoted literal and requires a matching review", () => {
    const report = fixture();
    const mutant = report.files["src/app/actions.ts"]!.mutants[0]!;
    mutant.status = "Survived";
    expect(() => auditMutationReport(report, [])).toThrow(/unreviewed/);
    const equivalent = {
      file: "src/app/actions.ts",
      mutator: mutant.mutatorName,
      location: mutant.location,
      original: '"use server"',
      replacement: mutant.replacement,
      reason:
        "Synthetic audit fixture; production allowlist is separately reviewed.",
    };
    expect(auditMutationReport(report, [equivalent])).toEqual({
      Killed: config.mutate.length - 1,
      Survived: 1,
    });
    for (const change of [
      { original: "different source" },
      { replacement: '"different replacement"' },
      { mutator: "BooleanLiteral" },
      { reason: "" },
      {
        location: {
          start: { line: 1, column: 2 },
          end: { line: 1, column: 13 },
        },
      },
    ]) {
      expect(() =>
        auditMutationReport(report, [{ ...equivalent, ...change }]),
      ).toThrow(/unreviewed/);
    }
    expect(() => auditMutationReport(fixture(), [equivalent])).toThrow(/Stale/);
  });
});
