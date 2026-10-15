# QA Report — App Foundation

> Spec: spec.md
> Date: 2026-10-13 · QA by: david-schwartzman · Mode: setup
> Verdict: PASS WITH NOTES
> Stale: spec changed 2026-10-15 (Acceptance Criteria) — rerun the qa skill

## Acceptance Criteria

| AC | Criterion | Result | Evidence |
|---|---|---|---|
| AC1 | `npm run dev` serves the app; every route renders Header + `main#main` + Footer | pass | Runtime (`next dev`): `/` → 200 and an unknown route → 404 both render `<header>`, `id="main"`, `<footer>`; e2e `e2e/smoke.spec.ts` "every page renders the shared layout"; `src/app/layout.tsx` composes SkipLink → Header → main#main → Footer |
| AC2 | lint, typecheck, test, build pass; TS strict; Prettier in lint; zod pinned | pass | All four commands exit 0 (see Checks Run); `tsconfig.json:7` `"strict": true`; `eslint.config.mjs:4,9` eslint-config-prettier + `package.json:9` `prettier --check .` in `lint`; `package.json:24` `"zod": "4.6.6"` |
| AC3 | GitHub Actions on every PR to `develop`: lint, typecheck, Vitest, Playwright smoke, build | pass | `.github/workflows/ci.yml` on `pull_request: branches: [develop]` with Lint, Typecheck, Unit tests, Build, E2E smoke steps; `--pass-with-no-tests` removed in T14 so an empty e2e suite now fails; PR #17 `ci` check SUCCESS |
| AC4 | Prisma for Neon with pooled `DATABASE_URL` + unpooled `DIRECT_URL`; one shared client | pass | `prisma/schema.prisma` datasource `url = env("DATABASE_URL")`, `directUrl = env("DIRECT_URL")`; `src/lib/db.ts` `globalThis`-cached `PrismaClient`; Prisma 6.19.3 pinned |
| AC5 | Preview per PR on its own Neon branch from `develop`; build runs `migrate deploy`; branch deleted on PR close; prod migrations only | pass (partly user-confirmed) | `vercel.json` buildCommand `DIRECT_URL="${DIRECT_URL:-$DATABASE_URL_UNPOOLED}" prisma migrate deploy && next build` (no seed; keeps `DIRECT_URL` when set, 3cf17b8); PR #17 and PR #18 Vercel checks SUCCESS; preview DB (`ep-super-heart-zasd0xv5`) answered `SELECT 1` and has `_prisma_migrations`; branch-per-preview (parent `develop`) and cleanup on PR close confirmed by user 2026-10-12 (T6.1/T6.2) |
| AC6 | Tokens are the Tailwind theme; fonts via `next/font` | pass | Production CSS: `.bg-volt{background-color:var(--volt)}`, `.text-on-volt`, `.rounded-pill{border-radius:var(--radius-pill)}`, `.bg-surface-alt`, `.font-display{font-family:var(--font-display)}`; `src/styles/tokens.css` imported by `src/app/globals.css` `@theme inline`; `src/app/layout.tsx` Barlow Condensed + Inter via `next/font/google` |
| AC7 | Header: wordmark, nav, placeholder search, labelled icons, cart count hidden at 0, sticky, drawer below `bp-md`, utility row slot | pass | `src/components/layout/Header.test.tsx` (17 tests: nav, search, aria-labels, cart count 0/3, signed-in label, sticky, default utility links → /account /signup /login, custom utility node; drawer: opens/Escape, Tab and Shift+Tab contained, scroll lock released on close, closes when viewport widens past bp-md, backdrop click, route change, link click, close button); `md:` = `@media (min-width:960px)` in production CSS; e2e 375px test: utility row hidden, drawer shows "Log in" |
| AC8 | Footer per Footer.dc.html element list; stacks at 375px with 16px padding | pass | `src/components/layout/Footer.test.tsx` (6 tests: inverse colours, brand + tagline, three columns, account links, hover underline, bottom row); `src/components/layout/Footer.tsx` `flex-col` + `px-4` below `md`; visual check at 375px during T13 |
| AC9 | Button/Input match props; Input label/hint/error via `aria-describedby`; focus ring; ≥ 44px targets | pass | `src/components/ui/Button.test.tsx` (7 tests) and `Input.test.tsx` (7 tests); Button md 48px, sm 36px + 4px pseudo-element each side = 44px touch target; Input 48px |
| AC10 | Skip link first focusable, jumps to `#main`; no h-scroll at 375px | pass | e2e "skip link is the first focusable element and jumps to #main"; e2e "skip link lands #main below the sticky header" at 375px and 1280px (`main#main` `scroll-mt-15 md:scroll-mt-24`, `src/app/layout.tsx`, f898fa3); e2e "at 375px … has no horizontal scroll" (`scrollWidth - innerWidth === 0`) |
| AC11 | No secrets: `.env*` ignored except example; example lists 4 vars with placeholders | pass | `.gitignore:36-37` `.env*` / `!.env.example`; `git ls-files` contains only `.env.example`; it lists `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET` with `YOUR_…` placeholders |

## Checks Run

- build: `npm run build` — pass
- lint: `npm run lint` (eslint + prettier --check) — pass
- typecheck: `npm run typecheck` (next typegen + tsc --noEmit) — pass
- tests: `npm test` — pass (37 passed, 0 failed, 4 files: Header 17, Footer 6, Button 7, Input 7)
- e2e: `npm run test:e2e` — pass (5 passed, Chromium, production build)

## Issues Found

(none). The previous run's stale CI comment was removed in 1e8568d.

## Notes

- **AC5 is partly on the user's word.** QA verified the build command, the preview build passing, and the preview database connection and migration table. That the database is a per-PR branch forked from `develop`, and that it is deleted on PR close, was confirmed by the user rather than observed. The cleanup method (Neon integration setting vs `delete-branch-action` workflow) is not recorded in tasks.md.
- **Re-run for PR #18.** This run replaces the 2026-10-12 report (at 8c9cdef), which predated the drawer fixes (cb75284, d62021c), the `DIRECT_URL` fallback (3cf17b8) and the skip-link offset (f898fa3). At QA time f898fa3 was local only; CI and the Vercel preview run once it is pushed.
- **Hygiene.** All tasks T1–T14 (incl. T6.1/T6.2) are `[x]`; no hotfix rows in the Changelog; spec `> Status: in-progress` (set to done on merge); PR #17 is merged into `develop`; PR #18 (T8–T15) is open.
- **Choices outside the spec text** (not failures): nav/footer links target `/catalog?category=…` and `/catalog?run=…` (catalog-search may change them; may 404 until built, per Out of Scope); mobile header switch follows the spec's `bp-md` 960px rather than the design CSS's 760px.
