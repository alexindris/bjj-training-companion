# Contributing

This project is being developed locally toward an open-source release. The code license has not been chosen; publication and external distribution need the maintainer’s approval. Do not add deployment integrations or hosted previews as part of the foundation.

## Development workflow

Follow the README’s install, environment, Compose, migration, and seed steps. Use synthetic accounts and data. Work on a topic branch and keep changes focused on one reviewable behavior.

Before submitting a change:

```sh
npm run format
npm run check
npm run build
# For UI, authentication, or authorization changes:
npm run test:e2e
```

Use TypeScript strict mode and the repository’s formatting/lint configuration. Add tests that prove externally meaningful behavior; avoid tests that only repeat implementation details. Use ready-for-review pull requests when repository publication is eventually authorized, unless explicitly asked for a draft.

## Schema and auth

Edit `src/db/schema.ts`, run `npm run db:generate`, review SQL, and commit the migration plus metadata. Apply it to a local PostgreSQL database with `npm run db:migrate`; verify both fresh application and reruns. Do not use schema push as a substitute for migrations or edit applied migrations.

Every private operation must derive identity from a verified server session, scope reads and mutations to that identity, and check ownership of related records. Never accept a caller-supplied user ID as authority. Add two-account isolation checks as training features arrive. Shared reference records are read-only to ordinary users. Never expose database configuration in client components.

Keep development seeding explicitly guarded, local, synthetic, and idempotent. Do not change existing development passwords or preferences silently. Do not introduce auth bypasses for testing.

## Language and content

Add each UI key to both `messages/en.json` and `messages/es.json`. Translate validation, loading, error, empty-state, and accessibility text. Keep enum values stable. Preserve user-authored text exactly as entered.

Reference content stays English. Keep stable IDs and provenance; personal overlays must remain separate from future upstream content. Do not bundle BJJGraph or other external datasets without reviewing the actual license and notices. Do not download or rehost instructional videos. Application licensing and content licensing are separate decisions.

## Current scope

The first release aims at a small gi-oriented goal/session/review loop for independent users. AI coaching, skill scores, social features, gym management, a rich graph editor, and full offline synchronization are deferred. The foundation UI must not imply that later milestone features already work.

## Secrets and diagnostics

Commit only `.env.example`; never commit `.env`, session tokens, personal data, database dumps, screenshots with personal records, or browser storage states. Error output should identify invalid configuration keys without printing values. Report security issues privately to the maintainer once a reporting channel is chosen; do not include secrets in issue reports.
