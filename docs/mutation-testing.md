# Targeted mutation testing

Run `npm run test:mutation` separately from the fast checks. This is a local,
slower test of the assertions themselves. It uses maintained StrykerJS 10 with
the command runner, Vitest unit suite, and TypeScript checker. See the official
[Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/),
[TypeScript checker](https://stryker-mutator.io/docs/stryker-js/typescript-checker/),
and [configuration](https://stryker-mutator.io/docs/stryker-js/configuration/)
documentation. Use the repository's documented Node version and `npm ci`.

The selected first-milestone logic is:

- `src/app/actions.ts`: credential and language validation, response handling,
  authentication cookies, sign-out, and session-owned language updates.
- `src/lib/session.ts`: session retrieval and profile ownership filtering.
- `src/lib/env.ts`: required PostgreSQL/auth configuration validation and
  value-free error messages.
- `scripts/seed-guard.ts`: the local synthetic-account seeding boundary.

This is deliberately targeted. UI rendering, generated files, SQL migration
metadata, dependency internals, and Better Auth itself are not mutation targets.
Real authentication and persistence are verified separately through the local
database and browser suites. Unit tests substitute those dependencies to make
every mutant fast and deterministic; they assert observable outcomes and the
verified account used at the database boundary. Mutation testing never opens a
database or changes an account.

Stryker copies code into its sandbox rather than mutating the working tree. The
sandbox excludes local environment files and generated outputs. Two Stryker workers keep
resource use bounded. The dedicated TypeScript configuration includes the target
code and unit tests; it does not require generated Next.js route types. The
TypeScript checker uses its accuracy mode and reports type-invalid mutants as
`CompileError`. A fresh full unit-test process runs for every valid mutant.
Mutation coverage analysis is disabled for the command runner; ordinary fresh
application coverage remains a separate gate. Static schema mutants still run;
no operators are excluded.

The initial native Vitest runner experiment reported an obviously incorrect
survivor: replacing the entire local seeding guard with an empty body. Manually
activating that same instrumented mutant in its unchanged sandbox caused 17
assertion failures and exited 1. Its aggregate report was 8.93%, with 102
survivors; it was rejected. This resembles the upstream
[per-test pairing issue](https://github.com/stryker-mutator/stryker-js/issues/6073).
The native Vitest runner always uses per-test selection, so changing
`coverageAnalysis` alone cannot avoid it. The maintained Stryker command runner
with `coverageAnalysis: "off"` runs every unit test in a fresh Vitest process
instead. Its first baseline killed 107 mutants and reported only five survivors.
This workaround increases work and avoids accepting the unreliable experiment
as quality evidence.

The raw Stryker score must be at least **90%** (95% is the high mark). The initial
90% budget allows explicitly reviewed equivalent mutations without requiring
artificial production abstractions. The stricter per-mutant audit means a new
meaningful survivor fails even when the aggregate score exceeds 90%. Uncovered
mutants, runtime errors, ignored/unknown statuses, missing targets, and empty
reports also fail. Timeout mutants count as detected by Stryker; the report must
be reviewed if they occur. No threshold is auto-updated.

Stryker's default operators do not generate arbitrary account-ID substitutions
or remove arbitrary Drizzle calls. The slower command therefore also executes
two explicit sandbox mutations: remove the owner predicate from the language
update, and replace verified-session retrieval with a forged first-account
identity. The unmodified sandbox must pass first. Each mutation must then cause
completed test assertions to fail; process startup, compilation, missing tests,
or unrelated runner errors do not qualify. These probes copy only authored code,
configuration, messages, and unit tests, reference the installed dependencies,
and clean up only their own generated sandbox. They never edit authored source
or connect to PostgreSQL.

`scripts/quality/mutation.mjs` deletes only `reports/mutation/`, runs Stryker, and
propagates its exit status. On success it records the report hash and a fingerprint
of application sources, selected tests, configuration, package lock, runner,
audit, and equivalence reviews. Inputs must remain unchanged during the run.
The audit checks that fingerprint and hash and compares every reported target's
source with the current file. Old reports cannot silently establish a pass.
The assertion-level boundary-probe report is also hashed and required.
Generated HTML, JSON, and evidence stay under ignored `reports/mutation/`.

To investigate a failure, open `reports/mutation/index.html` or inspect
`reports/mutation/mutation.json`. Reproduce the observable behavioral gap, add a
focused test, rerun it, and rerun the mutation command. Do not change expected
behavior, weaken gates, disable mutators, or exclude difficult application code
to obtain a pass.

An equivalent survivor can be recorded only after reviewing why it has no
observable effect under the declared contract. Each entry in
`scripts/quality/mutation-equivalents.json` must identify the exact file,
location, operator, original source, replacement, and reason. The audit rejects
unreviewed, mismatched, duplicate, or stale reviews. Unsupported mutants are
reported as limitations and do not silently become equivalent exceptions.

## Verified baseline

One test gap was found and repaired: an unsuccessful auth response with a
valid-looking JSON user identity could still reach profile lookup if the
`response.ok` guard were removed. Focused tests now exercise error statuses 403
and 500 with that body and require the safe error, no profile access, no cookies,
and no redirect.

The four surviving candidates below are individually reviewed in the tracked
equivalence file. Stryker report coordinates use one-based lines and columns;
the audit verifies exact quoted source literals, with an independent regression
fixture for that coordinate convention.

| Source                     | Equivalent replacement                                | Reason                                                                                                                                       |
| -------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/seed-guard.ts:12` | Empty URL fallback becomes `"Stryker was here!"`      | Both are invalid absolute URLs, so absent configuration still throws before seeding; native URL error wording is outside the contract.       |
| `src/lib/env.ts:8`         | Internal PostgreSQL refinement message becomes empty  | The exported error contains sanitized issue paths only.                                                                                      |
| `src/lib/env.ts:16`        | Internal auth-secret refinement message becomes empty | The exported error contains sanitized issue paths only.                                                                                      |
| `src/lib/env.ts:25`        | Issue path separator `"."` becomes empty              | Each issue path has exactly one key in this flat schema, producing the same public error. A nested schema would require reviewing this case. |

All three generated session-module candidates are type-invalid: removing required
auth headers, or removing a return value on which callers depend. They are
`CompileError`, not assertion kills. The explicit owner-predicate and forged
session probes supply behavioral evidence for valid authorization mutations.

On 2026-09-27, the complete stable command passed on Node 24.18.0 in about three
minutes: **168 candidates, 108 assertion kills, 56 type-invalid mutants, four
reviewed equivalents, and a raw score of 96.43%**. There were no runtime errors
or timeouts. Type-invalid mutants are excluded from Stryker's score denominator:
`108 / (108 + 4) × 100`. The actions module had 100% of its valid generated
mutants killed.

The explicit boundary probes first passed all **73** unmodified unit tests, then
each produced **two assertion failures**: owner removal broke preference
persistence and its failure handling; forged session identity broke visitor
isolation and verification-failure handling. Both probes and the report/source
freshness audit passed. The five mutation-audit regression tests also passed.

This evidence covers the selected application boundaries, not all possible
mutations or third-party implementations. The unsupported native Vitest runner
path is replaced, not accepted as a passing limitation.
