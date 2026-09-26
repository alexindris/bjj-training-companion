# Project boundaries

Use the milestone boundaries in `README.md` for scope. This checkout implements milestone 1; goals and training sessions belong to later work. Keep Spanish/English localization limited to the UI, reference fixtures in English, and personal records scoped to verified sessions.

Run locally. Do not provision cloud services, add hosted previews, publish the repository, or deploy without the maintainer's explicit authorization. The code license remains undecided. Use synthetic fixtures and keep secrets out of Git.

Validate with `npm run check`, `npm run test:db`, `npm run build`, and `npm run test:e2e`. Commit generated SQL migrations and their metadata. Use ready-for-review PRs if publication is later authorized, unless explicitly asked for a draft.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
