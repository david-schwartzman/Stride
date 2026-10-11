# Tasks — App Foundation

> Epic: accounts-auth
> Spec: 2026-10-08-app-foundation
> Branch: feat/accounts-auth/app-foundation

## Scaffold & tooling

- [ ] T1 Scaffold Next.js App Router app (TS strict, Tailwind, ESLint, src/, @/* alias); pin exact versions incl. zod and Prisma 6.x (prisma + @prisma/client — not 7)
- [ ] T2 Add Prettier + eslint-config-prettier; scripts lint, typecheck, test, test:e2e, db:migrate, db:generate, postinstall
- [ ] T3 Configure Vitest + RTL + jsdom (vitest.config.ts) and Playwright (playwright.config.ts, webServer on built app)
- [ ] T4 Add .env.example (DATABASE_URL, DIRECT_URL, PASSWORD_PEPPER, GUEST_CART_SECRET placeholders) and gitignore .env* except the example

## Database & previews (spike first)

- [ ] T5 Add prisma/schema.prisma (postgresql, url DATABASE_URL, directUrl DIRECT_URL, no models) and src/lib/db.ts globalThis-cached client
- [ ] T6 Link Vercel project + Neon–Vercel integration (preview branch per deploy from develop DB branch); set build to `prisma migrate deploy && next build`; map DIRECT_URL
- [ ] T6.1 Spike: open a throwaway PR, confirm preview build ran migrate deploy on its own Neon branch and connects (SELECT 1)
- [ ] T6.2 Delete the preview's Neon branch on PR close (integration setting or delete-branch-action workflow)

## CI

- [ ] T7 Add .github/workflows/ci.yml on pull_request: branches: [develop] — npm ci, lint, typecheck, vitest, playwright chromium, build, e2e

## Design system & layout

- [ ] T8 Port tokens.css into src/styles/tokens.css, import in globals.css, map to Tailwind theme; load Barlow Condensed + body font via next/font
- [ ] T9 Build src/components/ui/Button per ButtonProps + bundle.css
- [ ] T10 Build src/components/ui/Input (label, hint, error via aria-describedby, aria-invalid)
- [ ] T11 Build src/components/layout/Header (wordmark + volt slash, nav, placeholder search, icons w/ aria-labels, cartCount/accountName props, sticky) + client MobileNav drawer below bp-md
- [ ] T12 Build src/components/layout/Footer per pages/Footer.dc.html and SkipLink
- [ ] T13 Compose src/app/layout.tsx (SkipLink → Header → main#main → Footer) + placeholder src/app/page.tsx

## Verification

- [ ] T14 Write Vitest tests for Button, Input (error/aria wiring), Header (cart count hidden at 0, aria-labels) and the Playwright smoke (layout, skip link, 375px no h-scroll) (testing skill)
- [ ] T15 Run QA against acceptance criteria (qa skill)
