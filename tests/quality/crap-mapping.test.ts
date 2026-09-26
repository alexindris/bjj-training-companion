import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Linter } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { expect, test } from "vitest";
import {
  analyzeFile,
  coverageReportSchema,
  crapScore,
  functionComplexities,
} from "../../scripts/quality/crap-analysis";

test("uses ESLint classic complexity for branches, defaults, optional access, loops, catch, logical assignments and nested callbacks", () => {
  const source = `
    export function decisions(input: number = 1, object?: { value?: number }) {
      let value = input;
      if (value) value++;
      value = value > 1 ? 3 : 4;
      value ||= 1;
      value = object?.value ?? value;
      for (let index = 0; index < 1; index++) value++;
      for (const item of [1]) value += item;
      for (const key in object) value += key.length;
      while (value < 0) value++;
      do value++; while (value < 0);
      try { value++; } catch { value--; }
      switch (value) { case 1: value++; break; case 2: value--; break; default: break; }
      return [value].map((entry: number) => entry ? entry : 0);
    }`;
  const actual = functionComplexities(source, "fixture.ts");
  expect(actual.map((fn) => fn.complexity).sort((a, b) => a - b)).toEqual([
    2, 15,
  ]);
  const builtIn = new Linter().verify(
    source,
    [
      {
        files: ["**/*.ts"],
        languageOptions: { parser: tsParser },
        rules: { complexity: ["error", { max: 0, variant: "classic" }] },
      },
    ],
    { filename: "fixture.ts" },
  );
  expect(
    builtIn
      .map((message) =>
        Number(message.message.match(/complexity of (\d+)/)?.[1]),
      )
      .sort((a, b) => a - b),
  ).toEqual(actual.map((fn) => fn.complexity).sort((a, b) => a - b));
});

test("formula follows CRAP and refuses invalid inputs", () => {
  expect(crapScore(5, 0)).toBe(30);
  expect(crapScore(5, 1)).toBe(5);
  expect(crapScore(5, 0.5)).toBe(8.125);
  expect(() => crapScore(2, Number.NaN)).toThrow();
  expect(() => crapScore(2, -1)).toThrow();
});

test("real V8 TypeScript coverage maps bodies exactly, keeps nested coverage independent, and fails closed", async () => {
  const reports = await mkdtemp(path.join(os.tmpdir(), "bjj-crap-fixture-"));
  try {
    const run = spawnSync(
      process.execPath,
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "scripts/quality/crap-fixture.config.ts",
        "--coverage.reportsDirectory",
        reports,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, NODE_V8_COVERAGE: "" },
      },
    );
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
    const filename = "tests/quality/fixtures/mapping.ts";
    const source = await readFile(filename, "utf8");
    const coverage = coverageReportSchema.parse(
      JSON.parse(
        await readFile(path.join(reports, "coverage-final.json"), "utf8"),
      ),
    );
    const file = coverage[path.resolve(filename)];
    expect(file).toBeDefined();
    const scores = analyzeFile(source, filename, file);
    expect(scores).toHaveLength(7);
    const named = (name: string) =>
      scores.find((fn) =>
        fn.name.toLowerCase().includes(`'${name.toLowerCase()}'`),
      );
    expect(named("classify")?.complexity).toBe(2);
    expect(named("classify")?.coverage).toBeLessThan(1);
    expect(named("choose")?.complexity).toBe(2);
    expect(named("choose")?.coverage).toBe(1);
    expect(named("nested")?.complexity).toBe(1);
    expect(named("nested")?.coverage).toBe(1);
    expect(named("describe")?.complexity).toBe(2);
    expect(named("describe")?.coverage).toBeLessThan(1);
    expect(named("unused")?.coverage).toBe(0);
    expect(named("unused")?.crap).toBe(2);
    expect(named("optional")?.complexity).toBe(4);
    expect(named("switchValue")?.complexity).toBe(3);
    const missing = structuredClone(file);
    const id = Object.keys(missing.fnMap)[0];
    delete missing.fnMap[id];
    expect(() => analyzeFile(source, filename, missing)).toThrow(
      /Missing\/ambiguous/,
    );
    const countMissing = structuredClone(file);
    delete countMissing.f[id];
    expect(() => analyzeFile(source, filename, countMissing)).toThrow(
      /Missing function hit/,
    );
    const unmatched = structuredClone(file);
    unmatched.fnMap.extra = {
      name: "unexpected",
      loc: { start: { line: 1000, column: 0 }, end: { line: 1000, column: 1 } },
    };
    unmatched.f.extra = 1;
    expect(() => analyzeFile(source, filename, unmatched)).toThrow(
      /Unmatched coverage/,
    );
  } finally {
    await rm(reports, { recursive: true, force: true });
  }
}, 30_000);
