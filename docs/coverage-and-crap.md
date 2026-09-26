# Application coverage and CRAP

`npm run coverage` removes the previous `coverage/` directory, runs the focused
Vitest suite with fresh V8 coverage, enforces thresholds, verifies every measured
file and function mapping, then records source/report SHA-256 hashes. It does not
read the development database. `npm run crap:advisory` and `npm run crap` each
repeat that process before calculating their own report; neither accepts stale
coverage from a previous run. Generated HTML, JSON and provenance remain ignored
by Git.

## Measurement boundary

The numerical report measures all authored TypeScript under `src/lib/`, all of
`src/app/actions.ts`, and `scripts/seed-guard.ts`. That includes environment
validation, credential validation, auth configuration/profile creation hook,
sign-in response/error handling and cookies, sign-out, verified session/profile
queries, account-scoped preference writes, cookie security/lifetime settings,
class merging, and protection of synthetic development credentials. Every
function, including anonymous validation callbacks, must map to coverage.

Unit tests use real schemas and cookie parsing, while substituting the transport,
Next request APIs and database boundaries. Their coverage means the authored
orchestration executed, not that Better Auth or PostgreSQL internals are measured.
The independent integration and production-browser suites verify those boundaries
with real Better Auth and PostgreSQL. Browser execution is not merged into this
numerical report.

The source inventory in `scripts/quality/coverage-scope.ts` lists each remaining
authored source file individually, with a reason. New `src/lib` files join the
measurement automatically. New source elsewhere fails until it receives an
explicit, justified verification classification; there is no blanket TSX exclusion
which can silently hide a new policy file.

| Outside numerical coverage                                 | Verification and reason                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Locale pages/layout/error boundary and components          | Next rendering and interactive navigation are exercised in Playwright, including protected pages, sign-in, sign-out, locale persistence and English library content. Presentational error-boundary/brand/button rendering is also type/lint/build checked; every exceptional Next rendering path is not claimed covered. |
| `src/app/api/auth/[...all]/route.ts`                       | Thin Better Auth Next adapter: real HTTP integration and browser authentication.                                                                                                                                                                                                                                         |
| `src/db/index.ts`, `src/db/schema.ts`                      | Connection/declarative schema: real migrations, integration queries and PostgreSQL constraints.                                                                                                                                                                                                                          |
| `src/i18n/*`, `src/proxy.ts`                               | next-intl factories, routing and message selection: translation parity tests and English/Spanish browser navigation.                                                                                                                                                                                                     |
| Setup/build/seed/report runners and test/config files      | Developer tooling, not application logic. Seed's safety guard is measured; migrations/seed/setup/build execute during acceptance, and CRAP/coverage audit tooling has its own fixture tests. Tooling execution is not represented as application coverage.                                                               |
| `.next`, generated Drizzle metadata, reports, dependencies | Generated or third-party output; never authored application coverage.                                                                                                                                                                                                                                                    |

Thresholds apply **per measured file**: 90% statements, 90% lines, 90% branches,
100% functions. Vitest includes unimported measured files, so unused application
modules receive zero coverage. Missing files, missing/ambiguous functions, missing
hit counters and unsupported mappings fail with a nonzero exit code. Coverage
ignore directives in measured source also fail. These checks complement assertions;
100% execution does not establish correct behavior.

## Complexity and per-function coverage

The tool uses the installed, maintained [ESLint classic complexity rule](https://eslint.org/docs/latest/rules/complexity),
with `@typescript-eslint/parser` for native TypeScript syntax. A small adapter
captures ESLint's numeric result and source node directly at maximum zero, which
makes it report every function. It does not duplicate the complexity algorithm or
parse diagnostic wording. Classic complexity starts at one and increases for
`if`, ternaries, loops, catches, non-default switch cases, logical expressions and
assignments, parameter defaults, and optional access/calls. Nested functions have
independent scores. ESLint's `use-at-your-own-risk` built-in rule export is an
explicit tool API limitation: the pinned dependency and adapter fixtures must be
verified when upgrading ESLint. Unsupported implicit class initializers/static
blocks fail rather than receiving invented coverage.

[Vitest's V8 provider](https://vitest.dev/guide/coverage) produces an
[Istanbul JSON report](https://istanbul.js.org/docs/advanced/alternative-reporters/).
Each ESLint function body maps to exactly one `fnMap` entry by its start line and
column and ending line. The current Vitest 5 remapper emits some end columns as
Infinity, serialized to JSON `null`; the adapter accepts that known representation,
otherwise requiring equal end columns. It never matches by function name or by
file-wide percentage. Ambiguous mappings fail. Implicit else locations may be
empty objects; the adapter uses the parent branch location plus all branch hit
counters, not the empty location.

Statement and branch counters belong to the innermost function containing their
source start. This keeps an inner callback's missed path out of its parent's
coverage. Default-parameter branches belong to the declared function as well as
body branches. For a function that was called, its coverage fraction `cov` is the
lower of its own statement and branch hit fractions; an uncalled function is zero.
A called function with no statements or branches has fraction one. This is an
explicit conservative proxy, **not basis-path coverage**: JavaScript coverage
cannot prove all combinations of paths have been exercised.

The formula follows the [original CRAP proposal](https://www.artima.com/weblogs/viewpost.jsp?thread=215899):

```text
CRAP = complexity² × (1 − cov)³ + complexity
```

The regression suite compares captured complexity to ESLint's own diagnostics for
typed functions, branches, defaults, optional access, loops, catches, logical
assignments, switch cases and nested callbacks. A separate real V8 coverage run
executes an intentionally partially tested TypeScript fixture: named and arrow
functions, an uncalled arrow, nesting, default arguments and switch branches.
It verifies partial coverage stays partial and missing/extra mappings fail. Fixture
reports are created in a private temporary directory and removed afterward.

## Advisory inspection and gate decision

The first fresh advisory run measured 13 functions, with 100% of 66 statements,
39 branches, 13 functions and 62 lines covered. Inspection found sign-in highest
at complexity 13/CRAP 13, the local seed guard at 9/9, preference updates at 4/4,
and the locale cookie helper at 3/3. The remaining functions scored 1 or 2. The
sign-in score reflects necessary transport/status/cookie/error handling; no extra
abstraction was introduced to improve its score.

The initial candidate **CRAP ≤ 15 per function** is therefore retained and
enforced by `npm run crap`. It leaves a small margin above current observable
behavior while identifying new complexity or missed coverage. Equality passes;
only scores greater than 15 fail. The advisory command reports exceedances but
does not fail solely for the score; malformed or absent evidence and failed tests
still fail. Do not change thresholds, invent exclusions, split code solely for
scores, or remove behavioral assertions to make a check green. Repair behavior
and tests, rerun fresh coverage and CRAP, and explain any future reviewed boundary
change with evidence.
