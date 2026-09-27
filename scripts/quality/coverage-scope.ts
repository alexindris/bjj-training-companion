import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Every authored source file must be measured or explicitly classified below.
// New policy modules cannot disappear from coverage through a broad exclude glob.
export const coverageIncludes = [
  "src/lib/**/*.ts",
  "src/app/*actions.ts",
  "scripts/seed-guard.ts",
];

export const browserVerifiedSources: Record<string, string> = {
  "src/app/[locale]/error.tsx": "Next error boundary presentation",
  "src/app/[locale]/layout.tsx": "Next locale layout and provider wiring",
  "src/app/[locale]/library/page.tsx": "Protected reference library page",
  "src/app/[locale]/page.tsx": "Protected dashboard rendering",
  "src/app/[locale]/sign-in/page.tsx": "Sign-in page/session redirect",
  "src/app/api/auth/[...all]/route.ts": "Better Auth Next handler adapter",
  "src/components/app-shell.tsx": "Navigation and sign-out presentation",
  "src/components/brand.tsx": "Presentational brand",
  "src/components/language-switcher.tsx": "Locale action and navigation UI",
  "src/components/sign-in-form.tsx": "Progressively enhanced sign-in UI",
  "src/components/ui/button.tsx": "Radix/Tailwind button presentation",
  "src/db/index.ts": "PostgreSQL connection wiring: real integration suite",
  "src/db/schema.ts": "Declarative schema: migration/integration constraints",
  "src/i18n/navigation.ts": "next-intl navigation factory wiring",
  "src/i18n/request.ts": "next-intl request/message wiring",
  "src/i18n/routing.ts": "Declarative supported locales",
  "src/proxy.ts": "next-intl middleware wiring",
};

export async function measuredSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(path.join(root, "src"), {
    recursive: true,
    withFileTypes: true,
  });
  const sources = entries
    .filter((entry) => entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name))
    .map((entry) =>
      path.relative(root, path.join(entry.parentPath, entry.name)),
    )
    .sort();
  const measured = sources.filter(
    (file) =>
      file.startsWith("src/lib/") || /^src\/app\/[^/]*actions\.ts$/.test(file),
  );
  for (const file of sources) {
    if (!measured.includes(file) && !browserVerifiedSources[file]) {
      throw new Error(
        `Unclassified source file: ${file}. Add tests and measurement or justify its verification boundary.`,
      );
    }
  }
  for (const file of Object.keys(browserVerifiedSources)) {
    if (!sources.includes(file))
      throw new Error(`Stale coverage classification: ${file}`);
  }
  return [...measured, "scripts/seed-guard.ts"];
}

export async function sourceHashes(root: string) {
  const files = await measuredSourceFiles(root);
  return Object.fromEntries(
    await Promise.all(
      files.map(async (file) => {
        const source = await readFile(path.join(root, file), "utf8");
        if (/\b(?:istanbul|v8|c8)\s+ignore\b/.test(source)) {
          throw new Error(
            `Coverage suppression is not allowed in measured application logic: ${file}`,
          );
        }
        return [file, createHash("sha256").update(source).digest("hex")];
      }),
    ),
  );
}
