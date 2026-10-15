# Tasks — App Foundation

> Epic: accounts-auth
> Spec: 2026-10-08-app-foundation
> Branch: feat/accounts-auth/app-foundation
> PR: https://github.com/david-schwartzman/Stride/pull/17 · https://github.com/david-schwartzman/Stride/pull/18 (T8–T15)
> Reviewed: 2026-10-12 APPROVE (stale — spec changed 2026-10-15)

## Scaffold & tooling

- [x] T1 Scaffold Next.js App Router app (TS strict, Tailwind, ESLint, src/, @/* alias); pin exact versions incl. zod and Prisma 6.x (prisma + @prisma/client — not 7)
- [x] T2 Add Prettier + eslint-config-prettier; scripts lint, typecheck, test, test:e2e, db:migrate, db:generate (postinstall comes with the schema in T5)
- [x] T3 Configure Vitest + RTL + jsdom (vitest.config.ts) and Playwright (playwright.config.ts, webServer on built app)
- [x] T4 Add .env.example (DATABASE_URL, DIRECT_URL, PASSWORD_PEPPER, GUEST_CART_SECRET placeholders) and gitignore .env* except the example

## Database & previews (spike first)

- [x] T5 Add prisma/schema.prisma (postgresql, url DATABASE_URL, directUrl DIRECT_URL, no models), src/lib/db.ts globalThis-cached client, and the postinstall: prisma generate script
- [x] T6 Link Vercel project + Neon–Vercel integration (preview branch per deploy from develop DB branch); set build to `prisma migrate deploy && next build`; map DIRECT_URL
- [x] T6.1 Spike: open a throwaway PR, confirm preview build ran migrate deploy on its own Neon branch and connects (SELECT 1) — verified 2026-10-12: SELECT 1 OK, _prisma_migrations present on PR #17 preview branch
- [x] T6.2 Delete the preview's Neon branch on PR close (integration setting or delete-branch-action workflow) — confirmed done by user 2026-10-12

## CI

- [x] T7 Add .github/workflows/ci.yml on pull_request: branches: [develop] — npm ci, lint, typecheck, vitest, playwright chromium, build, e2e

## Design system & layout

- [x] T8 Port tokens.css into src/styles/tokens.css, import in globals.css, map to Tailwind theme; load Barlow Condensed + body font via next/font
- [x] T9 Build src/components/ui/Button per ButtonProps + bundle.css
- [x] T10 Build src/components/ui/Input (label, hint, error via aria-describedby, aria-invalid)
- [x] T11 Build src/components/layout/Header (wordmark + volt slash, nav, placeholder search, icons w/ aria-labels, cartCount/accountName props, utility ReactNode slot defaulting to signed-out UtilityLinks My orders · Sign up · Log in, sticky) + client MobileNav drawer below bp-md that also shows the utility items
- [x] T12 Build src/components/layout/Footer per AC8's element list (pages/Footer.dc.html) and SkipLink
- [x] T13 Compose src/app/layout.tsx (SkipLink → Header → main#main → Footer) + placeholder src/app/page.tsx

## Verification

- [x] T14 Write Vitest tests for Button, Input (error/aria wiring), Header (cart count hidden at 0, aria-labels, default utility row links, custom utility node rendered), Footer (AC8 columns, links and bottom row) and the Playwright smoke (layout, skip link, 375px no h-scroll) (testing skill)
- [x] T15 Run QA against acceptance criteria (qa skill)
