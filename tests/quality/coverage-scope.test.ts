import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import {
  browserVerifiedSources,
  measuredSourceFiles,
  sourceHashes,
} from "../../scripts/quality/coverage-scope";
import { verifyApplicationCoverage } from "../../scripts/quality/coverage";

async function scopeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "bjj-coverage-scope-"));
  for (const file of [
    ...Object.keys(browserVerifiedSources),
    "src/lib/policy.ts",
    "src/app/actions.ts",
    "src/app/training-actions.ts",
    "scripts/seed-guard.ts",
  ]) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), "export const marker = 1;\n");
  }
  return root;
}

test("every application source is measured or explicitly assigned a verification boundary", async () => {
  const root = await scopeFixture();
  try {
    expect(await measuredSourceFiles(root)).toEqual([
      "src/app/actions.ts",
      "src/app/training-actions.ts",
      "src/lib/policy.ts",
      "scripts/seed-guard.ts",
    ]);
    await writeFile(
      path.join(root, "src/new-policy.ts"),
      "export const ownership = true;",
    );
    await expect(measuredSourceFiles(root)).rejects.toThrow(
      "Unclassified source file",
    );
    await rm(path.join(root, "src/new-policy.ts"));
    await rm(path.join(root, "src/proxy.ts"));
    await expect(measuredSourceFiles(root)).rejects.toThrow(
      "Stale coverage classification",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("freshness fingerprint detects changes and rejects coverage ignore comments", async () => {
  const root = await scopeFixture();
  try {
    const before = await sourceHashes(root);
    await writeFile(
      path.join(root, "src/lib/policy.ts"),
      "export const marker = 2;\n",
    );
    const after = await sourceHashes(root);
    expect(after["src/lib/policy.ts"]).not.toBe(before["src/lib/policy.ts"]);
    await writeFile(
      path.join(root, "src/lib/policy.ts"),
      "/* v8 ignore next */ export const marker = 2;\n",
    );
    await expect(sourceHashes(root)).rejects.toThrow(
      "Coverage suppression is not allowed",
    );
    await rm(path.join(root, "scripts/seed-guard.ts"));
    await writeFile(
      path.join(root, "src/lib/policy.ts"),
      "export const marker = 2;\n",
    );
    await expect(sourceHashes(root)).rejects.toThrow(/ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing measured files in a syntactically valid coverage report cannot pass", async () => {
  const root = await scopeFixture();
  try {
    await expect(
      verifyApplicationCoverage(root, ["src/lib/policy.ts"], {}),
    ).rejects.toThrow("Coverage report omitted measured source");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
