import { Linter, type Rule } from "eslint";
import { builtinRules } from "eslint/use-at-your-own-risk";
import tsParser from "@typescript-eslint/parser";
import { z } from "zod";

const position = z.object({
  line: z.number().int().positive(),
  column: z.number().int().nonnegative(),
});
// Vitest 5's source mapper emits end columns as Infinity (JSON null). Keep
// source start and ending line; require unique body identity instead of guessing.
const coverageLocation = z.object({
  start: position,
  end: position.extend({ column: z.number().int().nonnegative().nullable() }),
});
const fileCoverageSchema = z.object({
  path: z.string(),
  fnMap: z.record(
    z.string(),
    z.object({ name: z.string(), loc: coverageLocation }),
  ),
  f: z.record(z.string(), z.number().nonnegative()),
  statementMap: z.record(z.string(), coverageLocation),
  s: z.record(z.string(), z.number().nonnegative()),
  branchMap: z.record(
    z.string(),
    z.object({ loc: coverageLocation, locations: z.array(z.unknown()) }),
  ),
  b: z.record(z.string(), z.array(z.number().nonnegative())),
});

export type Location = {
  start: z.infer<typeof position>;
  end: z.infer<typeof position>;
};
export type FileCoverage = z.infer<typeof fileCoverageSchema>;
export const coverageReportSchema = z.record(z.string(), fileCoverageSchema);

type FunctionNode = {
  type: string;
  loc: Location;
  body?: { loc: Location };
  parent?: { type: string; id?: { name?: string } };
};
export type FunctionComplexity = {
  name: string;
  complexity: number;
  body: Location;
  declaration: Location;
};
export type FunctionScore = FunctionComplexity & {
  coverage: number;
  statements: { covered: number; total: number };
  branches: { covered: number; total: number };
  crap: number;
};

// Capture the numeric result and original node directly from ESLint's maintained
// classic rule. No duplicated branch-counting implementation or message parsing.
export function functionComplexities(
  source: string,
  filename: string,
): FunctionComplexity[] {
  const original = builtinRules.get("complexity");
  if (!original) throw new Error("ESLint complexity rule is unavailable.");
  const functions: FunctionComplexity[] = [];
  const capture: Rule.RuleModule = {
    meta: original.meta,
    create(context) {
      const proxy = Object.create(context) as Rule.RuleContext;
      Object.defineProperty(proxy, "report", {
        value: (descriptor: Rule.ReportDescriptor) => {
          if (
            !("node" in descriptor) ||
            !descriptor.node ||
            !("data" in descriptor)
          ) {
            throw new Error("Unsupported ESLint complexity report shape.");
          }
          const node = descriptor.node as unknown as FunctionNode;
          if (!node.body || !node.body.loc || !descriptor.data) {
            throw new Error(
              `Unsupported function construct ${node.type}; add coverage mapping support before accepting it.`,
            );
          }
          const complexity = Number(descriptor.data.complexity);
          if (!Number.isInteger(complexity) || complexity < 1)
            throw new Error("Invalid complexity result.");
          const name =
            node.type === "ArrowFunctionExpression" &&
            node.parent?.type === "VariableDeclarator" &&
            node.parent.id?.name
              ? `Arrow function '${node.parent.id.name}'`
              : String(descriptor.data.name);
          functions.push({
            name,
            complexity,
            body: node.body.loc,
            declaration: node.loc,
          });
        },
      });
      return original.create(proxy);
    },
  };
  const messages = new Linter().verify(
    source,
    [
      {
        files: ["**/*.{ts,tsx,js,mjs}"],
        languageOptions: { parser: tsParser },
        plugins: { metrics: { rules: { complexity: capture } } },
        rules: {
          "metrics/complexity": ["error", { max: 0, variant: "classic" }],
        },
      },
    ],
    { filename },
  );
  if (messages.length)
    throw new Error(
      `Cannot analyze ${filename}: ${messages.map((message) => message.message).join("; ")}`,
    );
  return functions;
}

function comparePosition(a: Location["start"], b: Location["start"]) {
  return a.line - b.line || a.column - b.column;
}
function sameLocation(a: z.infer<typeof coverageLocation>, b: Location) {
  return (
    comparePosition(a.start, b.start) === 0 &&
    a.end.line === b.end.line &&
    (a.end.column === null || a.end.column === b.end.column)
  );
}
function contains(a: Location, b: Location) {
  return (
    comparePosition(a.start, b.start) <= 0 && comparePosition(a.end, b.end) >= 0
  );
}
function owningFunction(
  functions: FunctionComplexity[],
  loc: z.infer<typeof coverageLocation>,
  header = false,
) {
  // Start ownership remains precise even when the reporter loses end columns.
  // Parameter default branches belong to the declared function as well.
  return functions
    .filter((fn) => {
      const scope = header ? fn.declaration : fn.body;
      return (
        comparePosition(scope.start, loc.start) <= 0 &&
        comparePosition(scope.end, loc.start) >= 0
      );
    })
    .sort((a, b) => {
      if (contains(a.body, b.body)) return 1;
      if (contains(b.body, a.body)) return -1;
      return 0;
    })[0];
}

export function crapScore(complexity: number, coverage: number) {
  if (
    !Number.isFinite(complexity) ||
    complexity < 1 ||
    !Number.isFinite(coverage) ||
    coverage < 0 ||
    coverage > 1
  ) {
    throw new Error("CRAP requires positive complexity and coverage in [0,1].");
  }
  return complexity ** 2 * (1 - coverage) ** 3 + complexity;
}

export function analyzeFile(
  source: string,
  filename: string,
  rawCoverage: unknown,
): FunctionScore[] {
  const coverage = fileCoverageSchema.parse(rawCoverage);
  const functions = functionComplexities(source, filename);
  const seen = new Set<string>();
  const scores = functions.map((fn) => {
    const matches = Object.entries(coverage.fnMap).filter(([, candidate]) =>
      sameLocation(candidate.loc, fn.body),
    );
    if (matches.length !== 1)
      throw new Error(
        `Missing/ambiguous per-function coverage for ${filename}:${fn.body.start.line} ${fn.name}.`,
      );
    const id = matches[0][0];
    if (seen.has(id))
      throw new Error(`Duplicate function coverage mapping: ${filename}:${id}`);
    seen.add(id);
    if (coverage.f[id] === undefined)
      throw new Error(`Missing function hit count: ${filename}:${id}`);
    const statementCounts = Object.entries(coverage.statementMap)
      .filter(([, loc]) => owningFunction(functions, loc) === fn)
      .map(([key]) => {
        if (coverage.s[key] === undefined)
          throw new Error(`Missing statement hit count: ${filename}:${key}`);
        return coverage.s[key];
      });
    const branchCounts = Object.entries(coverage.branchMap)
      .filter(
        ([, branch]) => owningFunction(functions, branch.loc, true) === fn,
      )
      .flatMap(([key, branch]) => {
        if (
          !coverage.b[key] ||
          coverage.b[key].length !== branch.locations.length
        )
          throw new Error(`Missing branch hit counts: ${filename}:${key}`);
        return coverage.b[key];
      });
    const statements = {
      covered: statementCounts.filter((count) => count > 0).length,
      total: statementCounts.length,
    };
    const branches = {
      covered: branchCounts.filter((count) => count > 0).length,
      total: branchCounts.length,
    };
    const cov =
      coverage.f[id] === 0
        ? 0
        : Math.min(
            statements.total ? statements.covered / statements.total : 1,
            branches.total ? branches.covered / branches.total : 1,
          );
    return {
      ...fn,
      statements,
      branches,
      coverage: cov,
      crap: crapScore(fn.complexity, cov),
    };
  });
  for (const id of Object.keys(coverage.fnMap)) {
    if (!seen.has(id))
      throw new Error(
        `Unmatched coverage function in ${filename}:${id}. Check source-map support.`,
      );
  }
  return scores;
}
