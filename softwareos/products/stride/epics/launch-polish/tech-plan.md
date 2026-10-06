# Launch & Polish — Tech Plan

> Epic: epic.md · Product: ../../mission.md

## Approach

Set up a Neon production branch and a Vercel production environment, each with its own `DATABASE_URL`, `DIRECT_URL` and `AUTH_SECRET`. Production runs `prisma migrate deploy` and never runs the preview seed script (standards/global/tech-stack.md). The catalog is loaded with a one-off, idempotent step that reads the same catalog data file as the seed script, so the two can't drift apart. The tech-stack standard allows this as its one exception to the no-seed rule. Error, loading and not-found UI is built from Figma and wired through App Router conventions: a root `not-found.tsx` and `global-error.tsx`, plus per-segment `loading.tsx`, `error.tsx` and `not-found.tsx`. The empty states that earlier epics already built are aligned to one shared look instead of being rebuilt. `generateMetadata` adds page titles and meta. A responsive and accessibility pass is checked with Lighthouse. The epic finishes by running the existing landing → confirmation Playwright test from cart-checkout against a production-like preview deploy, followed by a read-only smoke check against the production URL.

## Architecture Impact

- No new services and no schema changes.
- Infra: the Vercel production environment plus a Neon production branch, with production env vars. The production deploy trigger is TBD (see Risks).
- Production env vars:
  - `DATABASE_URL`: Neon **pooled** connection string, used by the app at runtime.
  - `DIRECT_URL`: Neon **unpooled** connection string, used only by `prisma migrate deploy`. `prisma migrate` doesn't run reliably through Neon's pooler. `schema.prisma` sets `directUrl = env("DIRECT_URL")`. Preview deploys need the same pair for their branch.
  - `AUTH_SECRET`.
- A one-off, idempotent production catalog load step. It is separate from the preview seed, which never runs on production, and it reads the same catalog data file. That file (e.g. `prisma/catalog-data.ts`) has to exist as its own module that both the seed and the load import. This is a requirement on `catalog-foundation` (catalog-search). If that spec has already shipped without it, `production-deploy` extracts it.
- New shared UI: root and per-segment not-found / error / loading files, and metadata on every page. The empty states from earlier epics are aligned to Figma.
- The Playwright config gets a `BASE_URL` option so tests can target a deployed URL. The full shopping-flow test runs against a production-like preview deploy, and a separate read-only spec runs against production.
- Polish touches every existing route but doesn't change the data flow.

## Risks & Unknowns

- **Production deploy trigger:** the git workflow standard sends every PR to `develop` and says `main` is not a PR target, but doesn't define how code reaches production. Settle the release step (e.g. a `develop` → `main` promotion) and record it in the standard before shaping `production-deploy`. `config.yml` also sets `default_branch: main`, which doesn't match the standard.
- The production catalog load could run twice, or the preview seed could run against prod by mistake. Make the load idempotent (upserts keyed by slug), and make the seed refuse to run on the production `DATABASE_URL`.
- Migrations on deploy: a failed `migrate deploy` must block the release instead of leaving a half-migrated database.
- **Rollback for a bad deploy that migrated successfully:** Vercel can roll the app back instantly (Instant Rollback / promote the previous deployment), but database migrations don't roll back. Rules:
  - Every migration must stay backward-compatible with the previous deploy's code (expand → contract). Add columns and tables first, and drop or rename them only in a later release once no deployed code reads them.
  - Rollback steps are documented in `production-deploy`: promote the previous Vercel deployment, confirm the production smoke check passes, then fix forward with a new migration if the schema needs correcting. Never edit or revert an applied migration.
- **Smoke testing without touching production data:** the full landing → confirmation purchase flow (which creates users and orders and reduces stock) runs only against a production-like preview deploy on its own Neon branch. Against production, the smoke check is read-only: key pages load, the catalog is populated, a product page renders, and no request returns 5xx. No orders, no stock changes, and CI gets no production database secret.
- Figma may not define every error and loading state for all 8 pages. Any gaps need design input.
- Neon cold starts and serverless connection limits can slow the first load. Use pooled connection strings.
- Reaching Lighthouse ≥ 90 may need image and font work on pages built in earlier epics.
- Spike: none. Validate the deploy pipeline early with a hello-world production deploy.

## Candidate Specs

- `production-deploy` — Vercel production env + Neon production branch, env vars (pooled `DATABASE_URL` + unpooled `DIRECT_URL`), `migrate deploy` on release, deploy gated by CI, one-off idempotent catalog load from the shared catalog data file, backward-compatible migration rule and documented Vercel rollback steps
- `error-loading-states` — root and per-route not-found / error / loading boundaries across all 8 pages per Figma; align the earlier epics' empty states to one shared look
- `responsive-a11y-pass` — 375px mobile layout fixes, focus states, form and icon-button labels, alt text, page metadata/SEO, Lighthouse accessibility ≥ 90 on Home, Catalog, Product, Cart, Checkout and Login, keyboard-only checkout run
- `launch-smoke-test` — run the existing landing → confirmation Playwright test against a production-like preview deploy via `BASE_URL`, plus a read-only Playwright smoke check against the production URL (no orders, no stock changes, no production DB access from CI)
