# App Foundation

> Epic: ../../epic.md
> Status: in-progress
> Branch: feat/accounts-auth/app-foundation
> Covers: package.json, next.config.ts, tsconfig.json, eslint.config.mjs, .prettierrc, postcss.config.mjs, vitest.config.ts, playwright.config.ts, .github/workflows/**, prisma/schema.prisma, src/app/layout.tsx, src/app/globals.css, src/styles/**, src/components/layout/**, src/components/ui/**, vercel.json, .env.example, .gitignore

## Overview

The enabling spec for Accounts & Auth and every later epic. It delivers no user-facing auth behaviour of its own; it makes the epic's success criteria buildable:

- CI + Playwright wiring → "Playwright: sign up → log out → log in → reach a protected page passes in CI" (signup-login / protected-routes add the actual test).
- Zod installed + shared `Input` primitive with inline-error support → "Zod validates the forms on client and server".
- SSR-by-default layout, tokens and a 375px-safe Header → the mission's fast-first-paint and mobile goals.

Includes the tech plan's spike: Prisma + Neon + Vercel preview smoke test. The User model and first real migration belong to `signup-login`; header session state belongs to `protected-routes`. `src/app/page.tsx` ships as a throwaway placeholder and is **not** claimed — `catalog-search` owns `/`.

## Goals & User Stories

- As a developer on any later spec, I can clone, `npm install`, set `.env.local` from `.env.example`, and run the app, tests and migrations locally.
- As a reviewer, every PR gets green/red CI (lint, typecheck, unit, e2e smoke, build) and a Vercel preview backed by its own Neon branch.
- As a shopper (any page), I see the Stride header and footer in the brand look, usable at 375px and by keyboard.

## Acceptance Criteria

1. AC1: `npm run dev` serves the app; every route renders the shared layout (Header + `<main id="main">` + Footer).
2. AC2: `npm run lint`, `npm run typecheck`, `npm test` (Vitest) and `npm run build` pass locally; TypeScript `strict` is on; Prettier is wired into lint; `zod` is installed as a pinned dependency.
3. AC3: A GitHub Actions workflow runs on every PR to `develop` — lint, typecheck, Vitest, Playwright smoke, build — and fails the check on any error.
4. AC4: Prisma is configured for Neon with pooled `DATABASE_URL` and unpooled `DIRECT_URL` (`directUrl`); `src/lib/db.ts` exports a single shared Prisma client (no duplicate clients under dev hot-reload).
5. AC5: Each PR's Vercel preview uses its own Neon branch forked from the `develop` database branch; the preview build runs `prisma migrate deploy` against it; the branch is deleted when the PR closes. Production runs migrations only, never a seed.
6. AC6: Design tokens from `stride-design/design-system/tokens.json` / `tokens.css` are the Tailwind theme — e.g. `bg-volt text-on-volt rounded-pill`, `bg-surface-alt`, `font-display` resolve to the token values; fonts load via `next/font`.
7. AC7: Header matches the design: STRIDE wordmark with volt slash, nav Shoes · Apparel · Gear, search field (visual placeholder only — no behaviour), account / wishlist / cart icons (each with `aria-label`); cart count hidden when 0; sticky; below `bp-md` the nav becomes a menu button opening a drawer. Above the bar, a grey utility row (`surface-alt`, per `bundle.css` `.st-header__utility`, `aria-label="Help and account"`) shows "My orders" (→ `/account`) · "Sign up" (→ `/signup`) · "Log in" (→ `/login`); below `bp-md` the row is hidden and the same items appear in the drawer. The row's content is a `utility` slot (any React nodes, not only `{label, href}` links) so protected-routes can put a logout form in it. Always renders signed-out here (account → `/login`, signed-out utility row).
8. AC8: Footer per `stride-design/pages/Footer.dc.html`: `surface-inverse` background with `on-inverse` text; "Stride" brand line and the tagline "Less choice. Clearer guidance. Faster decisions. Running gear for your first 5K and 10K."; three link columns — "Shop by run" (Road, Trail, Race day), "Shop" (Shoes, Apparel, Gear), "Your account" (Sign in → `/login`, My orders → `/account`, Wishlist → `/wishlist`); a bottom row "© 2026 Stride · A Moveo Academy capstone · Prices in USD" and "$5 shipping · free on orders over $75". Links underline on hover. At 375px the columns stack with 16px side padding.
9. AC9: `Button` and `Input` primitives match the props in `components/index.d.ts` and `bundle.css`: `Input` has a visible label, `hint`, and an `error` linked via `aria-describedby`; both show a focus ring on `:focus-visible` and have ≥ 44px touch targets.
10. AC10: "Skip to content" is the first focusable element and jumps to `#main`; at 375px there is no horizontal scroll.
11. AC11: No secrets in the repo: `.env*` (except `.env.example`) is gitignored; `.env.example` lists `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET` with placeholder values (e.g. `YOUR_SECRET_HERE`).

## Technical Approach

- **Scaffold:** `create-next-app` (App Router, TypeScript strict, Tailwind, ESLint, `src/` dir, `@/*` alias), current stable Next.js; **Prisma 6** (latest 6.x — Prisma 7 moves `directUrl` out of `schema.prisma` and would break AC4); pin exact versions of next, react, prisma, @prisma/client, zod (signup-login adds exact-pinned `@node-rs/argon2`, `@oslojs/crypto` and `@oslojs/encoding` for the in-house auth module). Prettier + `eslint-config-prettier`. Scripts: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (vitest run), `test:e2e` (playwright), `db:migrate`, `db:generate`, `postinstall: prisma generate` (added together with `prisma/schema.prisma` — `prisma generate` fails without a schema, so adding it earlier breaks `npm install`/`npm ci`).
- **Testing:** Vitest + React Testing Library + jsdom (`vitest.config.ts`, `@vitejs/plugin-react`, tsconfig paths). Playwright with `webServer` running the built app; one smoke spec (layout renders, skip link, 375px no h-scroll).
- **Prisma / Neon:** `prisma/schema.prisma` with `datasource db { provider = "postgresql"; url = env("DATABASE_URL"); directUrl = env("DIRECT_URL") }` and the client generator — **no models** (User arrives in signup-login). `src/lib/db.ts`: `globalThis`-cached `PrismaClient` singleton. Local dev points at a personal Neon dev branch.
- **Vercel + Neon previews:** Vercel project linked to the GitHub repo; Neon's Vercel integration creates a branch per preview deployment from the `develop` DB branch and injects connection strings. Build command (in `vercel.json`) `DIRECT_URL="${DIRECT_URL:-$DATABASE_URL_UNPOOLED}" prisma migrate deploy && next build`: uses `DIRECT_URL` when set, otherwise falls back to the integration's `DATABASE_URL_UNPOOLED`. Seed step hooks in later (catalog-search adds the seed + production guard). Branch cleanup on PR close via the integration's deletion setting or a `neondatabase/delete-branch-action` workflow on `pull_request: closed`.
- **Spike / smoke:** before building UI, prove one preview: deploy a PR, confirm the build ran `migrate deploy` against its Neon branch and the app connects (`prisma db execute` `SELECT 1` in the build log, or a one-off check removed before merge).
- **CI:** `.github/workflows/ci.yml` on `pull_request: branches: [develop]` → Node LTS, `npm ci`, lint, typecheck, `vitest run`, `playwright install --with-deps chromium`, build, `test:e2e`. No DB needed in CI yet (no models); add a Neon branch to CI when signup-login's e2e needs one.
- **Tokens → Tailwind:** copy `tokens.css` variables into `src/styles/tokens.css`, imported by `src/app/globals.css`; map them to Tailwind theme names (Tailwind v4 `@theme inline`, or v3 `theme.extend` if create-next-app pins v3) per the design README's mapping (colors, `font-display`/`font-sans`, radii, shadows, breakpoints). Barlow Condensed + body font via `next/font/google` bound to `--font-display` / `--font-sans`.
- **UI primitives** (`src/components/ui/`): `Button` (variants per `ButtonProps`, volt accent only for action buttons), `Input` (label/hint/error, `aria-invalid`, `aria-describedby`). Server-safe where possible; `"use client"` only if they need state.
- **Layout** (`src/components/layout/`): `Header` (Server Component shell; tiny client `MobileNav` drawer + menu button), `Footer`, `SkipLink`. Icons from `lucide-react` (matches the design's 24px/2px style). `src/app/layout.tsx` composes them around `<main id="main">`. Header takes `cartCount` / `accountName` props (default 0 / undefined) and a `utility?: React.ReactNode` slot (default: the signed-out `UtilityLinks` — My orders · Sign up · Log in), so protected-routes and cart-checkout can wire real values and a logout form later without changing its API. This deliberately widens the design's `utility: {label, href}[]` prop, which can't hold a form; the drawer renders the same `utility` content.
- **Env:** `.env.example`; `.gitignore` covers `.env*` except the example; `PASSWORD_PEPPER` (signup-login) and `GUEST_CART_SECRET` (cart-checkout) listed now so Vercel envs are set once, each generated with `openssl rand -base64 32` and different per environment.

## Out of Scope

- User/Session models, the auth module (`src/lib/auth/`), `/login` `/signup` pages, proxy/middleware (signup-login, protected-routes).
- Header session state / real cart count (protected-routes, cart-checkout).
- Header search behaviour — the field is a visual placeholder; catalog-search wires it to the URL.
- Target routes of header nav / wishlist / cart / account links — built by later epics and may 404 until then. That is expected and **not a QA failure** for this spec.
- Home page content at `/` (catalog-search); seed script + production seed guard (catalog-search).
- `not-found.tsx`, `error.tsx`, `global-error.tsx` (launch-polish).
- Components beyond Button / Input (Badge, Price, ProductCard, … built by the specs that first need them).
- Production deploy and domain (launch-polish).
- Login throttling (signup-login), analytics, error monitoring.

## Standards Applied

- [global/tech-stack](../../../../../../standards/global/tech-stack.md) — defines the whole scaffold: Next/Tailwind/Prisma/Neon, `DIRECT_URL`, Neon branch per preview, migrations-only in production.
- [global/git-workflow](../../../../../../standards/global/git-workflow.md) — branch off `develop`, PRs to `develop`, commit format; CI targets PRs to `develop`.

## Changelog

| Date | Author | Type | Change | Ref |
|---|---|---|---|---|
| 2026-10-08 | david-schwartzman | created | Initial shaping | — |
| 2026-10-11 | david-schwartzman | change | AC11 + Env: `.env.example` lists PASSWORD_PEPPER, GUEST_CART_SECRET instead of AUTH_SECRET; scaffold pins no Auth.js; Out of Scope wording — adopt Stride Auth & Session Security Plan: Auth.js Credentials is JWT-only (no revocation); move to own DB-session module + Argon2id | https://claude.ai/artifact/QL1DDEEN6QERM6GsZP4a8h |
| 2026-10-11 | david-schwartzman | change | Technical Approach + T1: pin Prisma 6 (latest 6.x) explicitly — Prisma 7 removes `directUrl` from schema.prisma, so "current stable" would make AC4 unbuildable; project decision recorded in standards/global/tech-stack.md | [INFRA_PLAN.md](../../../../../../../INFRA_PLAN.md) Step 2 |
| 2026-10-12 | david-schwartzman | change | AC7 + Technical Approach: Header utility row (My orders · Sign up · Log in) defined, as a `utility` ReactNode slot so protected-routes can place the logout form; AC8: Footer made checkable (listed elements instead of "matches Footer.dc.html"); T11/T12/T14 updated — PR #12 review | https://github.com/david-schwartzman/Stride/pull/12 |
| 2026-10-12 | david-schwartzman | change | Covers adds `.gitignore` (AC11, T4 edit it); Changelog ref to `INFRA_PLAN.md` now links the file (on `develop` since #13); references.md drops the stale "stride-design/ is untracked" note — PR #12 review (2nd round) | https://github.com/david-schwartzman/Stride/pull/12 |
| 2026-10-12 | david-schwartzman | change | Technical Approach + T2/T5: postinstall `prisma generate` moves from T2 to T5 — it needs prisma/schema.prisma, so adding it in T2 broke npm install/ci on every commit until T5 | — |
| 2026-10-13 | david-schwartzman | change | Covers drops `src/lib/db.ts`: deleted, the web no longer has a Prisma client (the API's `PrismaService` owns database access) — auth code moved into the API by auth-api-migration (its T28) | [auth-api-migration](../2026-10-13-auth-api-migration/spec.md) |
