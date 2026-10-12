# QA Report — App Foundation

> Spec: spec.md
> Date: 2026-10-12 · QA by: david-schwartzman · Mode: setup
> Verdict: PASS WITH NOTES

## Acceptance Criteria

| AC | Criterion | Result | Evidence |
|---|---|---|---|
| AC1 | `npm run dev` serves the app; every route renders Header + `main#main` + Footer | pass | Runtime (`next dev`): `/` → 200 and an unknown route → 404 both render `<header>`, `id="main"`, `<footer>`; e2e `e2e/smoke.spec.ts` "every page renders the shared layout"; `src/app/layout.tsx` composes SkipLink → Header → main#main → Footer |
| AC2 | lint, typecheck, test, build pass; TS strict; Prettier in lint; zod pinned | pass | All four commands exit 0 (see Checks Run); `tsconfig.json:7` `"strict": true`; `eslint.config.mjs:4,9` eslint-config-prettier + `package.json:9` `prettier --check .` in `lint`; `package.json:24` `"zod": "4.6.6"` |
| AC3 | GitHub Actions on every PR to `develop`: lint, typecheck, Vitest, Playwright smoke, build | pass | `.github/workflows/ci.yml` on `pull_request: branches: [develop]` with Lint, Typecheck, Unit tests, Build, E2E smoke steps; `--pass-with-no-tests` removed in T14 so an empty e2e suite now fails; PR #17 `ci` check SUCCESS |
| AC4 | Prisma for Neon with pooled `DATABASE_URL` + unpooled `DIRECT_URL`; one shared client | pass | `prisma/schema.prisma` datasource `url = env("DATABASE_URL")`, `directUrl = env("DIRECT_URL")`; `src/lib/db.ts` `globalThis`-cached `PrismaClient`; Prisma 6.19.3 pinned |
| AC5 | Preview per PR on its own Neon branch from `develop`; build runs `migrate deploy`; branch deleted on PR close; prod migrations only | pass (partly user-confirmed) | `vercel.json` buildCommand `DIRECT_URL="$DATABASE_URL_UNPOOLED" prisma migrate deploy && next build` (no seed); PR #17 Vercel check SUCCESS; preview DB (`ep-super-heart-zasd0xv5`) answered `SELECT 1` and has `_prisma_migrations`; branch-per-preview (parent `develop`) and cleanup on PR close confirmed by user 2026-10-12 (T6.1/T6.2) |
| AC6 | Tokens are the Tailwind theme; fonts via `next/font` | pass | Production CSS: `.bg-volt{background-color:var(--volt)}`, `.text-on-volt`, `.rounded-pill{border-radius:var(--radius-pill)}`, `.bg-surface-alt`, `.font-display{font-family:var(--font-display)}`; `src/styles/tokens.css` imported by `src/app/globals.css` `@theme inline`; `src/app/layout.tsx` Barlow Condensed + Inter via `next/font/google` |
| AC7 | Header: wordmark, nav, placeholder search, labelled icons, cart count hidden at 0, sticky, drawer below `bp-md`, utility row slot | pass | `src/components/layout/Header.test.tsx` (11 tests: nav, search, aria-labels, cart count 0/3, signed-in label, sticky, default utility links → /account /signup /login, custom utility node, drawer contents/focus/Escape); `md:` = `@media (min-width:960px)` in production CSS; e2e 375px test: utility row hidden, drawer shows "Log in" |
| AC8 | Footer per Footer.dc.html element list; stacks at 375px with 16px padding | pass | `src/components/layout/Footer.test.tsx` (6 tests: inverse colours, brand + tagline, three columns, account links, hover underline, bottom row); `src/components/layout/Footer.tsx` `flex-col` + `px-4` below `md`; visual check at 375px during T13 |
| AC9 | Button/Input match props; Input label/hint/error via `aria-describedby`; focus ring; ≥ 44px targets | pass | `src/components/ui/Button.test.tsx` (7 tests) and `Input.test.tsx` (7 tests); Button md 48px, sm 36px + 4px pseudo-element each side = 44px touch target; Input 48px |
| AC10 | Skip link first focusable, jumps to `#main`; no h-scroll at 375px | pass | e2e "skip link is the first focusable element and jumps to #main"; e2e "at 375px … has no horizontal scroll" (`scrollWidth - innerWidth === 0`) |
| AC11 | No secrets: `.env*` ignored except example; example lists 4 vars with placeholders | pass | `.gitignore:36-37` `.env*` / `!.env.example`; `git ls-files` contains only `.env.example`; it lists `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET` with `YOUR_…` placeholders |

## Checks Run

- build: `npm run build` — pass
- lint: `npm run lint` (eslint + prettier --check) — pass
- typecheck: `npm run typecheck` (next typegen + tsc --noEmit) — pass
- tests: `npm test` — pass (31 passed, 0 failed, 4 files)
- e2e: `npm run test:e2e` — pass (3 passed, Chromium, production build)

## Issues Found

| # | Severity | Issue | Route |
|---|---|---|---|
| 1 | low | `.github/workflows/ci.yml` keeps the comment `# --pass-with-no-tests until T14 adds the smoke spec.` after the flag was removed in T14 | One-line follow-up commit (comment only) |

## Notes

- **AC5 is partly on the user's word.** QA verified the build command, the preview build passing, and the preview database connection and migration table. That the database is a per-PR branch forked from `develop`, and that it is deleted on PR close, was confirmed by the user rather than observed. The cleanup method (Neon integration setting vs `delete-branch-action` workflow) is not recorded in tasks.md.
- **Unpushed work.** At QA time, 8 local commits (T8–T14, T6.x tick) were not pushed, so CI and the Vercel preview have not yet run on them. Local results above are the evidence; push via the pr skill.
- **Hygiene.** All tasks T1–T14 (incl. T6.1/T6.2) are `[x]`; no hotfix rows in the Changelog; spec `> Status: in-progress` (set to done on merge); PR #17 is open as a draft.
- **Choices outside the spec text** (not failures): nav/footer links target `/catalog?category=…` and `/catalog?run=…` (catalog-search may change them; may 404 until built, per Out of Scope); mobile header switch follows the spec's `bp-md` 960px rather than the design CSS's 760px.
