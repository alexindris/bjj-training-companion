# Third-party dependencies and reference content

The package lockfile records the exact installed dependency graph. Dependencies retain their package license files and notices; the application’s future license does not replace them. Core direct dependencies include Next.js/React, Better Auth, Drizzle ORM/Kit, node-postgres, next-intl, Zod, Tailwind CSS, Radix Slot, Lucide, and the TypeScript/ESLint/Prettier/Playwright toolchain. Review their shipped license files when preparing distribution.

PostgreSQL is supplied by the official `postgres` container image and retains its upstream PostgreSQL license and image notices.

The English position and technique summaries in `scripts/seed.ts` and `src/lib/reference-fixtures.ts` are original minimal fixture text. Each record carries provenance. The Library links to two Chewjitsu videos on YouTube with creator attribution, reviewed titles and start times; the app does not embed, download, copy or rehost those videos, thumbnails or transcripts. External links do not grant a license to their content. No third-party technique corpus, authored probability estimates or training observations are included.

BJJGraph was discussed as a possible future source. It has not been imported or licensed for this repository. Review its then-current terms and required notices before any reuse; do not infer permission from the intended application code license. Keep eventual importers optional and independent from the core training workflow.
