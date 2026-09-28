# Contributing

This project’s source is public on GitHub and developed locally toward an open-source release. The code license has not been chosen; public visibility does not grant an open-source license. Do not add deployment integrations or hosted previews as part of these local milestones.

## Development workflow

Follow the README’s install, environment, Compose, migration, and seed steps. Use synthetic accounts and data. Work on a topic branch and keep changes focused on one reviewable behavior.

Before submitting a change:

```sh
npm run format
npm run verify:fast
npm run verify:full
# For validation, authentication, ownership or preference changes:
npm run test:mutation
```

The full check needs a running local Docker runtime and Playwright Chromium (`npx playwright install chromium`). Database integration and browser checks start disposable `postgres:17.9-alpine` containers with Testcontainers, wait for readiness, and use random mapped ports. They generate ephemeral synthetic passwords and authentication secrets, so `.env`, the development Compose service and database creation privileges on an existing server are not required. Testcontainers removes its owned containers and their data; browser acceptance also removes its temporary production-build workspace. Keep the resource reaper enabled and do not point tests at personal or remote data. Leave development previews running: acceptance uses its own free loopback port. Use `test:e2e` to provision the browser environment; the internal `test:browser` runner requires that isolated environment. Development Compose setup remains separate from test provisioning. Use Node 24 through `.nvmrc` (22.18+ or 24.11+ supported) and `npm ci` for the pinned toolchain.

Use strict TypeScript, Prettier, zero ESLint warnings, complexity ≤15, nesting ≤4 and ≤4 parameters for application code. Per-file application coverage gates are 90% statements/branches/lines and 100% functions; CRAP ≤15. Run `npm run coverage`, `npm run crap:advisory`, or `npm run crap` for fresh evidence. Stryker's raw mutation score gate is 90%, plus no unreviewed meaningful survivors. Exact coverage boundaries, calculation/mapping checks, mutation limitations and reviewed equivalents are documented in [coverage/CRAP](docs/coverage-and-crap.md) and [mutation testing](docs/mutation-testing.md).

Test observable outcomes: accepted/rejected inputs, verified identities, stored preferences, UI language, protected access, and unchanged English references. Mock external boundaries for focused unit checks; use real Better Auth and PostgreSQL for browser acceptance. A test passing against a mock does not replace integration evidence. Coverage measures execution, not correctness.

When a check fails, identify the behavioral or infrastructure cause, repair it, and rerun the relevant check. Recollect coverage/CRAP after source or test changes; rerun mutation testing after changing its targets or assertions. Keep inputs stable during report generation. Do not change expected behavior, lower thresholds, disable rules/mutators, suppress coverage, or exclude authored behavior merely to make a gate pass. Equivalent mutations require an exact, reasoned review; unsupported cases remain explicit limitations. Any justified future contract or gate change needs separate maintainer review and evidence.

Make small, coherent local commits after relevant checks pass. Before every commit, inspect the complete staged diff and run `git diff --cached --check`; ensure no secrets, `.env`, personal/local database contents, generated reports or unrelated changes are included. Commit source/configuration/fixtures and migration metadata, not generated quality results. Report any unresolved failure honestly and never declare completion until relevant checks and full acceptance pass. Use ready-for-review pull requests when a pull request is requested, unless explicitly asked for a draft.

## Schema and auth

Edit `src/db/schema.ts`, run `npm run db:generate`, review SQL, and commit the migration plus metadata. Apply it to a local PostgreSQL database with `npm run db:migrate`; verify both fresh application and reruns. Do not use schema push as a substitute for migrations or edit applied migrations.

Every private operation must derive identity from a verified server session, scope reads and mutations to that identity, and check ownership of related records. Never accept a caller-supplied user ID as authority. Keep two-account isolation checks for goals, focus, logs, history, browser drafts and reference notes. Shared reference records are read-only to ordinary users; only the current account can change its position/technique notes. Never expose database configuration in client components.

Keep development seeding explicitly guarded, local, synthetic, and idempotent. Do not change existing development passwords or preferences silently. Do not introduce auth bypasses for testing.

## Language and content

Add each UI key to both `messages/en.json` and `messages/es.json`. Translate validation, loading, error, empty-state, and accessibility text. Keep enum values stable. Preserve user-authored text exactly as entered.

Reference content stays English. Keep stable IDs and provenance; private notes remain separate from shared content. Preserve reviewed video source/title, start time and provenance, and use ordinary safe links without embeds or thumbnails. Do not bundle BJJGraph or other external datasets without reviewing the actual license and notices. Do not download or rehost instructional videos. Application licensing and content licensing are separate decisions.

## Current scope

The first release aims at a small gi-oriented goal/session/review loop for independent users. AI coaching, skill scores, social features, gym management, a rich graph editor, and full offline synchronization are deferred. Milestones 1–3 include foundation, goals, classes, ordinary account-specific local drafts, read-only history, and a small searchable reference Library with private notes. Keep one class-draft editing tab per account as the documented MVP limit. Weekly reviews, saved training edits/deletes, export/restore, goal-reference links and expanded reference features remain deferred. The UI must not imply that later milestone features already work.

## Secrets and diagnostics

Commit only `.env.example`; never commit `.env`, session tokens, personal data, database dumps, screenshots with personal records, or browser storage states. Error output should identify invalid configuration keys without printing values. Report security issues privately to the maintainer once a reporting channel is chosen; do not include secrets in issue reports.
