# Milestone 2 local verification

This report records the implemented training loop and supersedes the milestone-1-only scope in the earlier verification report. Verification uses Node.js 24.18.0, the pinned lockfile, local Docker and disposable PostgreSQL 17.9 containers. Production browser acceptance runs in its own temporary workspace on a free loopback port. Development credentials, the persistent development database and other previews are not test inputs.

## Behavior

Goals are owned by the verified account. Creating a goal leaves it inactive; profiles hold zero or one owned active goal. Classes can stand alone or include one owned goal observation. Date and nonblank technique are required; a selected goal requires an outcome. Optional counts retain unknown versus zero, enforce the supported range and compare only known pairs. Personal text is stored verbatim while the interface supports English and Spanish.

The class and observation save in one transaction. An account/submission unique constraint makes retries return the original record. Already saved receipts preserve edited retry input and link the unchanged original. Ordinary failures retain the same submission ID and form fields. Controls are disabled while saving.

One versioned localStorage draft is keyed by account. Recovery precedes persistence of fresh defaults, permits unfinished fields and partial counts, and retains the recovered goal over current focus. Confirmed new saves remove the draft; storage failures warn and retain current input in memory. Owned history is read-only, ordered by date, creation time and ID, and bounded to 25 entries per page. Foreign and missing detail IDs receive the same not-found presentation.

The additive migration preserves existing identity, preference and reference rows. Integration checks cover both upgrades and fresh databases, direct owned foreign-key constraints, transaction rollback, duplicate retries, independent account submission IDs, nullable counts and history ordering.

## Verification evidence

Fresh checks on 27 September 2026 passed on stable application sources:

| Command                 | Result                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify:fast`   | Formatting, zero-warning lint, strict types and 296 unit/quality tests in 13 files pass. Also rerun as part of full acceptance.                                  |
| `npm run coverage`      | Every measured file has 100% statements, branches, functions and lines: 223 statements, 134 branches, 44 functions and 200 lines.                                |
| `npm run crap:advisory` | Exact function mapping passes for all 44 functions; none exceed 15.                                                                                              |
| `npm run crap`          | Enforced fresh mapping/coverage passes; maximum CRAP and complexity are 13, in the existing sign-in function. New training logic peaks at 9.                     |
| `npm run test:db`       | Additive upgrade preservation, fresh/rerun migrations and seeds, owned relationships, atomic/duplicate saves, null/zero counts and ordered bounded history pass. |
| `npm run verify:full`   | Fast checks, enforced CRAP, disposable PostgreSQL checks, isolated production build and all 14 Chromium journeys pass.                                           |
| `npm run test:mutation` | 96.25% raw score; exact source/review audit and both retained ownership/session probes pass. No meaningful survivors, uncovered mutants or timeouts remain.      |

The browser journeys retain six foundation regressions and add eight training journeys covering both languages, outcomes, retries, honest duplicate receipts, partial recovery, changed focus, two real accounts, forged actions, storage failures and narrow mobile layouts. Test navigation waits for visible action completion. Synthetic client addresses isolate these journeys from the existing intentional authentication rate-limit test; authentication still uses real Better Auth.

The final mutation run has 477 candidates: 308 assertion kills, 157 type-invalid
candidates and 12 exactly reviewed equivalents. Type-invalid candidates are
excluded from the raw denominator: `308 / (308 + 12) × 100 = 96.25%`. Both action
modules kill every valid generated mutant. The unmodified boundary-probe suite
passes 285 unit tests; each retained ownership/session probe then produces two
completed assertion failures. The source/report/probe fingerprint audit passes.
Interrupted runs and the earlier run with an unreviewed meaningful survivor are
not counted as final acceptance evidence.

One meaningful focus-return projection test gap was repaired. The 12 equivalents
comprise four retained foundation reviews, seven redundant validation-error
variants and one owned-row existence projection. The validation variants preserve
complete issue objects through the current owning schema's identical error;
41 observations per variant confirmed this. A disposable PostgreSQL probe
confirmed unchanged existence-row counts for the projection equivalent and a
SQL error for the meaningful return-projection mutant. Exact reviews and their
conditions are in `scripts/quality/mutation-equivalents.json` and
[the mutation guide](mutation-testing.md). No gates or mutators were weakened.

## Measurement boundary

Numerical coverage includes every authored module under `src/lib/`, server action modules matching `src/app/*actions.ts`, and `scripts/seed-guard.ts`. This includes training validation, local draft policy, verified action authorization, owned queries and transactional persistence. It does not merge browser coverage into the unit measurements.

Each UI, schema and framework source outside that boundary is individually classified in `scripts/quality/coverage-scope.ts`, with real browser, integration or build verification. Generated and third-party sources are outside the authored-source inventory. New unclassified authored sources fail. Exact function mapping and all existing per-file coverage, complexity and CRAP gates remain enforced; named refinements avoid a pinned V8 inline-callback mapping limitation without relaxing mapping rules.

Mutation targets retain the foundation authentication, preference, session and seed boundaries and add training actions, validation and persistence. Existing mutation boundary probes and exact equivalent reviews remain in place. Meaningful survivors must be fixed and rerun; equivalent reviews match the exact current source, location, mutator and replacement.

## Accepted limits

Supported draft use is one editing tab per account. Browser storage is local, unencrypted convenience recovery; there are no cross-tab locks, conflict protocols, background sync or cross-device recovery. History uses ordinary bounded offset pagination. Saved edits/deletes, weekly review, export/restore, goal lifecycle tools and expanded references remain deferred.

Pinned ESLint 9's documented support limitation remains unchanged. Code licensing remains undecided. Work stays local; this milestone creates no deployment, hosted preview, cloud service, push or pull request.

## Local implementation commits

Branch: `alex/milestone-2-training-loop`, from `718b7d1`.

| Commit    | Change                                                                             |
| --------- | ---------------------------------------------------------------------------------- |
| `c097436` | Owned schema and additive migration/metadata.                                      |
| `e5e9d54` | Training validation and account-local draft recovery.                              |
| `7d5db94` | Verified server operations, owned persistence/queries and database/quality checks. |
| `4696fae` | Bilingual goals, class forms, receipts and read-only history.                      |
| `a560da6` | Eight real-auth training browser journeys.                                         |
| `3d0f943` | Contributor scope, behavior and accepted limits.                                   |
| `d9a1f0b` | Meaningful focus-return projection assertions and exact equivalent reviews.        |

This report is saved in a final documentation commit after all required checks pass. Private planning artifacts and generated quality reports are outside Git.
