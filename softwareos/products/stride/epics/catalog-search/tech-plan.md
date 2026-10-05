# Catalog & Search — Tech Plan

> Epic: epic.md · Product: ../../mission.md

## Approach

Server Components render Home, Catalog and Product detail, reading through the shared Prisma client module. Catalog state (search query, filters, sort, price range) lives in URL search params. The server reads those params and runs one Prisma query, so results are server-rendered and shareable. Small Client Components only update the URL (search box, filter controls) or hold local UI state (size selector). This epic creates the Prisma schema and seed script for Category, Product and ProductVariant, with images in /public served by next/image. Add-to-cart and wishlist buttons are placed on the pages but wired up in later epics.

## Architecture Impact

This is the first epic, so it creates the base:

- New Next.js App Router project (TypeScript strict, Tailwind, ESLint/Prettier, Vitest, Playwright, GitHub Actions CI).
- Prisma + Neon setup, a shared Prisma client module, and the first migration with models Category, Product, ProductVariant (size + stock). Product holds run type, gender, beginner tag, price in cents and slug.
- Seed script for the catalog.
- Routes `/`, `/catalog`, `/product/[slug]`, plus a shared layout/header.
- No new external services.

## Risks & Unknowns

- Schema for filters: run type/gender as enums vs. tags. This decides query shape, so settle it in the first spec.
- Product data and images: need ~30 real-looking products with licensed images before the seed. Content work could block.
- Combined filters + search + sort in one Prisma query: keep it simple (case-insensitive contains) and don't add full-text search.
- Neon cold starts may slow the first SSR load. Check on a Vercel preview.
- Size model: half sizes for shoes vs. XS–XL vs. one size. Make sure ProductVariant handles all three cleanly.
- Spike: none needed beyond a quick Prisma + Neon + Vercel preview smoke test in spec 1.

## Candidate Specs

- `catalog-foundation` — app scaffold, CI, Prisma schema (Category/Product/ProductVariant), seed data, shared layout
- `product-catalog` — /catalog grid with search, filters, price range and sort via URL params, plus the no-results state
- `product-detail` — /product/[slug] with images, beginner tag, size selector, per-size stock, out-of-stock state
- `home-page` — hero, featured products, shop-by-category / shop-by-run-type entry points; lands the Playwright e2e (landing → catalog → filter → product detail) as the slice that completes the journey
