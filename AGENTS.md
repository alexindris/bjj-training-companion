# Project boundaries

Use the milestone boundaries in `README.md` for scope. This checkout implements milestones 1–3: foundation, owned goals, class logging, basic account-specific local draft recovery, read-only history, and a small searchable reference Library with timestamped external links and account-owned notes. Weekly review, saved training edits/deletes, export/restore, goal-reference linking and expanded corpus tools belong to later work. Keep Spanish/English localization limited to the UI, reference fixtures in English, and personal records scoped to verified sessions.

Run locally. Do not provision cloud services, add hosted previews, publish the repository, or deploy without the maintainer's explicit authorization. The code license remains undecided. Use synthetic fixtures and keep secrets out of Git.

Use Node 24 (`.nvmrc`; minimum supported 22.18 or 24.11) and the pinned lockfile. Run `npm run verify:fast` during changes and `npm run verify:full` before declaring completion. Run `npm run test:mutation` separately after changing validation, authentication, ownership or preference logic/tests. Full acceptance requires a running local Docker runtime and Playwright Chromium. Testcontainers starts disposable `postgres:17.9-alpine` containers, waits for readiness, selects random mapped ports and removes their data. Tests generate ephemeral synthetic passwords and authentication secrets; they do not read `.env` or need the development Compose service or database creation privileges on an existing server. Keep Testcontainers’ resource reaper enabled. Browser acceptance uses an isolated production build and a free loopback port; never reuse or reset the main development database or another running preview. Docker Compose remains the persistent development workflow.

Enforce formatting, zero lint warnings, strict types, complexity ≤15, depth ≤4 and ≤4 parameters. Fresh application coverage requires per-file statements/branches/lines ≥90% and functions 100%; CRAP ≤15. Mutation testing requires raw score ≥90% and no unreviewed meaningful survivors. Read `docs/coverage-and-crap.md` and `docs/mutation-testing.md` for measurement boundaries, mapping limits, exact equivalent reviews and runner caveats. New unclassified authored sources fail rather than disappearing from coverage.

Agents must investigate and fix failures, rerun relevant checks with fresh evidence, and run full acceptance before declaring completion. Never weaken gates, disable rules/mutators, suppress/exclude our behavior, remove assertions, or change acceptance expectations merely to pass. Unsupported cases and unresolved failures must remain explicit. Any future justified gate/contract change requires separate maintainer review. Prefer tests of observable behavior over implementation mirrors. Keep sources/tests stable during coverage or mutation runs.

Make small cohesive verified local Git commits. Before every commit inspect the complete staged diff, run `git diff --cached --check`, and ensure it includes no secrets, environment values, local database contents, generated quality reports or unrelated changes. Commit generated SQL migrations and their metadata. Use ready-for-review PRs when a pull request is requested, unless explicitly asked for a draft.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
