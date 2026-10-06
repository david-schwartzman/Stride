# Launch & Polish — Tech Plan

> Epic: epic.md · Product: ../../mission.md

## Approach

Set up a Neon production branch and a Vercel production environment, each with its own `DATABASE_URL` and `AUTH_SECRET`. Production runs `prisma migrate deploy` and never runs the seed script (standards/global/tech-stack.md). The catalog is loaded with a one-off, idempotent step that reads the same catalog data as the seed script, so the two can't drift apart. Error, loading and not-found UI is built from Figma and wired through App Router conventions: a root `not-found.tsx` and `global-error.tsx`, plus per-segment `loading.tsx`, `error.tsx` and `not-found.tsx`. The empty states that earlier epics already built are aligned to one shared look instead of being rebuilt. `generateMetadata` adds page titles and meta. A responsive and accessibility pass is checked with Lighthouse. The epic finishes by running the existing landing → confirmation Playwright test from cart-checkout against the production URL.

## Architecture Impact

- No new services and no schema changes.
- Infra: the Vercel production environment plus a Neon production branch, with production env vars. The production deploy trigger is TBD (see Risks).
- A one-off, idempotent production catalog load step. It is separate from the preview seed, which never runs on production, and it reads the same catalog data file.
- New shared UI: root and per-segment not-found / error / loading files, and metadata on every page. The empty states from earlier epics are aligned to Figma.
- The Playwright config gets a `BASE_URL` option so the existing shopping-flow test can target production.
- Polish touches every existing route but doesn't change the data flow.

## Risks & Unknowns

- **Production deploy trigger:** the git workflow standard sends every PR to `develop` and says `main` is not a PR target, but doesn't define how code reaches production. Settle the release step (e.g. a `develop` → `main` promotion) and record it in the standard before shaping `production-deploy`. `config.yml` also sets `default_branch: main`, which doesn't match the standard.
- The production catalog load could run twice, or the preview seed could run against prod by mistake. Make the load idempotent (upserts keyed by slug), and make the seed refuse to run on the production `DATABASE_URL`.
- Migrations on deploy: a failed `migrate deploy` must block the release instead of leaving a half-migrated database.
- The smoke test against prod creates real users and orders and reduces stock. It uses a dedicated test user and cleans up its orders afterwards. Cleanup must restore stock, and it needs production database access from CI, which is a new secret to store and limit.
- Figma may not define every error and loading state for all 8 pages. Any gaps need design input.
- Neon cold starts and serverless connection limits can slow the first load. Use pooled connection strings.
- Reaching Lighthouse ≥ 90 may need image and font work on pages built in earlier epics.
- Spike: none. Validate the deploy pipeline early with a hello-world production deploy.

## Candidate Specs

- `production-deploy` — Vercel production env + Neon production branch, env vars, `migrate deploy` on release, deploy gated by CI, one-off idempotent catalog load
- `error-loading-states` — root and per-route not-found / error / loading boundaries across all 8 pages per Figma; align the earlier epics' empty states to one shared look
- `responsive-a11y-pass` — 375px mobile layout fixes, focus states, form and icon-button labels, alt text, page metadata/SEO, Lighthouse accessibility ≥ 90 on Home, Catalog and Product, keyboard-only checkout run
- `launch-smoke-test` — run the existing landing → confirmation Playwright test against the production URL via `BASE_URL`, with a test user and order cleanup that restores stock
