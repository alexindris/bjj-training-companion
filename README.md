# BJJ Training Companion

A mobile-first training companion for keeping a focus, reflecting after class, and reviewing progress over time. Built locally toward an open-source release, with ordinary PostgreSQL and authentication inside the application.

**Milestone 1 is the foundation:** Next.js App Router and TypeScript, PostgreSQL in Docker Compose, committed Drizzle migrations, real Better Auth email/password sessions, two synthetic development users, and English/Spanish interface localization. Training goals, logs, draft recovery, and weekly reviews are not implemented yet.

The repository is hosted privately on GitHub. Application code licensing is **pending the maintainer’s choice**; `UNLICENSED` is intentional until then. Do not describe this checkout as licensed open-source software or make it public before that decision. See [LICENSE.md](LICENSE.md).

## Run locally

Prerequisites: Node.js 24 (use `.nvmrc`; supported alternatives are Node 22.18+ or 24.11+), npm 10 or later, Docker Desktop (running) or Docker Engine with Compose. No hosting, identity-provider, cloud, or email-service account is required.

```sh
npm ci
npm run env:setup
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). All commands run from the repository root.

`env:setup` copies `.env.example`, generates random local authentication and development-account secrets, and never overwrites an existing `.env`. You can instead copy the example manually and replace both placeholders. The auth secret must have at least 32 characters; the development password must have 12–128. `.env` is ignored by Git. The example contains only local fixture credentials and placeholders.

| Synthetic user | Email                | Initial UI language |
| -------------- | -------------------- | ------------------- |
| Sam Demo       | `sam@example.test`   | English             |
| Jamie Demo     | `jamie@example.test` | Spanish             |

Both accounts use your **`DEV_USER_PASSWORD` value in `.env`**. The development sign-in screen lists the emails; it never renders the password. Production builds hide this helper. Seed creation uses Better Auth and stores hashed passwords, not plaintext. Re-running the seed preserves existing passwords and language choices. Changing the environment password does not reset an existing account.

English and Spanish routes use `/en` and `/es`. Language switching saves the signed-in user’s preference in PostgreSQL and a browser cookie. On subsequent sign-in, the saved account language takes precedence over the sign-in page language. Each account has an independent preference. Anonymous switching saves only the cookie. Reference titles and descriptions remain English, with English language attributes; future user-authored text must be stored verbatim.

## Environment and local services

| Variable                                            | Purpose                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Local Compose database credentials. Change `DATABASE_URL` to match.                        |
| `POSTGRES_PORT`                                     | Host port, default `5432`. Update `DATABASE_URL` if changed.                               |
| `DATABASE_URL`                                      | Standard PostgreSQL connection string, used only on the server.                            |
| `BETTER_AUTH_URL`                                   | Application origin, normally `http://localhost:3000`. Must match the browser and app port. |
| `BETTER_AUTH_SECRET`                                | Random secret; changing it invalidates sessions.                                           |
| `ALLOW_DEV_SEED`                                    | Must be `true` to explicitly enable synthetic local seeding.                               |
| `DEV_USER_PASSWORD`                                 | Local synthetic password. Never reuse a personal password.                                 |

The database publishes only to `127.0.0.1`; the app’s documented commands also bind to loopback. PostgreSQL uses a named volume, so stopping containers retains data. `npm run db:down` stops and removes containers while keeping that volume. Compose health checks ensure PostgreSQL is ready before migrations.

If port 5432 is occupied, change `POSTGRES_PORT` and `DATABASE_URL` in `.env`, then restart Compose. If changing the application port, change `BETTER_AUTH_URL` and run `npm run dev -- --port 3001`. Acceptance checks allocate their own loopback port. If existing-volume credentials differ from `.env`, restore matching credentials rather than assuming changed environment variables update the database.

## Database changes

```sh
# After editing src/db/schema.ts:
npm run db:generate
# Review and commit the generated SQL and metadata.
npm run db:migrate
npm run db:seed
```

Use migrations, not schema push. The initial schema contains Better Auth identity tables, owned profiles with constrained locale/training defaults, and a shared reference fixture table. Authentication sessions are named `auth_sessions`; future training sessions should be named `training_sessions`.

`db:seed` refuses production environments and non-loopback database hosts. Never migrate or seed an unfamiliar database. No test training observations or real personal records are bundled. `db:studio` is optional and binds to loopback.

## Local quality checks

The checks stay within milestone 1 and run on your computer. Coverage and mutation measurement details are documented below.

```sh
# Once per machine:
npx playwright install chromium
# Fast feedback: formatting, lint, strict types, focused behavioral/audit tests
npm run verify:fast
# Full acceptance: fast checks, fresh CRAP/coverage, Testcontainers integration,
# fresh migrations/seed, isolated production build and real browser acceptance
npm run verify:full
# Separate reports/checks:
npm run coverage
npm run crap:advisory
npm run crap
npm run test:mutation
```

`npm run check` aliases the fast workflow. `npm run test:db` runs database integration alone; `npm run test:e2e` runs the isolated production build and browser suite. `test:browser` is an internal runner that requires the isolated Testcontainers acceptance environment. Every enforcing command returns a nonzero exit status on failure. Mutation testing is intentionally separate from full acceptance because each mutant runs a fresh focused test process.

Static rules require Prettier formatting, zero ESLint warnings, strict TypeScript, maximum classic function complexity 15, nesting depth 4, and 4 parameters in application sources. Library declaration checking remains skipped for Next.js compatibility; our own source and test types are checked. ESLint 9 remains pinned for the Next configuration’s plugin peer compatibility; its support limitation and upgrade requirement are documented in the coverage guide. Runtime checks require Node 22.18+ or 24.11+ because the maintained quality tools depend on newer runtime features; `.nvmrc` selects Node 24 and installation rejects unsupported engines.

Coverage measures all library logic, server actions, and the local seed guard. Per-file gates require 90% statements/branches/lines and 100% functions. Each CRAP command collects fresh coverage and verifies exact function mapping; the enforced maximum is **15**. Individually classified UI, schema, and framework wiring is verified by browser/integration/build checks instead of being included in that numerical report. New unclassified application files, missing coverage, stale evidence, and unsupported mappings fail. See [coverage and CRAP](docs/coverage-and-crap.md) for the calculation, inventory and limitations.

Mutation testing targets validation, authentication orchestration, session ownership, and locale preferences using StrykerJS plus the TypeScript checker. The raw score gate is 90%, with a stricter audit that rejects every unreviewed meaningful survivor and uncovered mutant. Reviewed equivalent cases must match exact current code. See [mutation testing](docs/mutation-testing.md) for the runner workaround, targeted checks and survivor investigation.

Database integration and browser acceptance use [Testcontainers for Node.js](https://node.testcontainers.org/modules/postgresql/) to start their own disposable `postgres:17.9-alpine` containers. They require a running local Docker runtime; they do not require `.env`, the development Compose service, an available port 5432, or database creation privileges on an existing server. Testcontainers waits for PostgreSQL readiness, assigns random mapped database ports, and removes the test containers and their data after each run. The harness generates ephemeral synthetic account passwords and authentication secrets; it never reads development credentials. Browser acceptance also makes a temporary copy of the current working tree and installed dependencies, builds there, and serves on a free loopback port. It exercises real Better Auth sessions and revocation, invalid credentials, protected/forged access, independent account language persistence, forged preference payloads, both UI languages, English reference content, origin checks, rate limits, and mobile layout. It leaves the development database and any preview on port 3000 untouched. Normal completion and failures clean up the temporary workspace and stop the owned containers; Testcontainers’ resource reaper handles interrupted-process cleanup while Docker remains available. After a machine or Docker crash, inspect ownership before removing any leftover test resources. Docker Compose remains the persistent development database workflow.

Keep sources stable during report runs. Generated coverage, mutation reports, browser screenshots and traces are ignored by Git. Repair a failing behavior or test, rerun the relevant check, then run full acceptance before declaring completion. Never change acceptance expectations, weaken gates, disable rules, or add exclusions merely to obtain a passing result. See [CONTRIBUTING.md](CONTRIBUTING.md).

For a local production smoke check, stop the development server, then:

```sh
npm run build
npm start
```

This runs the build on your computer; it does not deploy anything. A build requires configured environment values, but pages query PostgreSQL at request time. `output: "standalone"` prepares a portable Node.js server; the build command copies static assets beside it, and `npm start` loads local environment values and starts that server on loopback. Do not configure hosting or automated previews during this phase.

## Structure and boundaries

```text
src/app/            Localized pages, server actions, auth HTTP handler
src/components/     UI components and owned shadcn-style button
src/db/             Drizzle schema and ordinary pg connection pool
src/i18n/           next-intl routing and message loading
src/lib/            Auth, session verification, environment validation
messages/           English/Spanish UI messages
drizzle/            Versioned SQL migrations and snapshots
scripts/            Environment setup and guarded development seed
tests/              Foundation unit and real-browser acceptance checks
docs/               Engineering context and local verification report
```

The browser does not receive database credentials. Protected pages verify real sessions on the server. The locale action derives the account ID from that session; callers cannot submit another account ID. Shared references have no user mutation route. Future training operations must enforce ownership at the operation and relationship level; a page redirect is not sufficient authorization. The pool is bounded locally and reused during development hot reload. Hosted aggregate connection limits must be assessed when hosting is actually chosen.

## Content and dependencies

The four English starter positions are original minimal fixtures with stable IDs and provenance. They are not a curriculum or a imported BJJGraph dataset. Techniques, video links, and external corpus imports are deferred to milestone 3. No videos or thumbnails are downloaded or rehosted. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Dependencies and the lockfile are pinned. The narrow `typed-rest-client`/`qs` override selects patched qs 6.16.0 for mutation tooling; review it when upgrading Stryker. The narrow esbuild override removes a vulnerable obsolete transitive version used by Drizzle Kit’s TypeScript loader; migration generation and application must be checked when changing it. Integrations follow the official [Better Auth Next.js guide](https://better-auth.com/docs/integrations/next), [Drizzle adapter guide](https://better-auth.com/docs/adapters/drizzle), and [next-intl routing guide](https://next-intl.dev/docs/routing/setup).

## Next milestones

1. **Foundation (this checkout):** reproducible setup, database, authentication, two users, language switching.
2. **Training loop:** create/activate goals, log class technique and observations, recover drafts, inspect history.
3. **Reference links:** curate the English corpus, search, techniques, video timestamps, and private notes.
4. **Review and durability:** weekly review, goal history, edits, export, and full cross-user isolation tests.
5. **Local acceptance:** phone-oriented review, production-build check, export/restore verification.
6. **Publication:** only after the maintainer’s explicit approval, with code/content license and hosting decisions.

Production signup policy, email verification/reset, hosting providers, backups, and content licensing remain open decisions. Email/password works locally without email delivery; no email flows are advertised.

Contributions: [CONTRIBUTING.md](CONTRIBUTING.md).
