# Third-party dependencies and reference content

The package lockfile records the exact installed dependency graph. Dependencies retain their package license files and notices; the application’s future license does not replace them. Core direct dependencies include Next.js/React, Better Auth, Drizzle ORM/Kit, node-postgres, next-intl, Zod, Tailwind CSS, Radix Slot, Lucide, and the TypeScript/ESLint/Prettier/Playwright toolchain. Review their shipped license files when preparing distribution.

PostgreSQL is supplied by the official `postgres` container image and retains its upstream PostgreSQL license and image notices.

The English seed in `scripts/seed.ts` is original, minimal fixture text. Each record carries a provenance statement. No third-party technique corpus, thumbnails, videos, authored probability estimates, or training observations are included.

BJJGraph was discussed as a possible future source. It has not been imported or licensed for this repository. Review its then-current terms and required notices before any reuse; do not infer permission from the intended application code license. Keep eventual importers optional and independent from the core training workflow.
