# Tech Stack

## Frontend

- Next.js (App Router) with React and TypeScript
- Tailwind CSS for styling
- `next/image` for optimized product images

## Backend

- Built into Next.js — no separate Express server
- Server Components for data loading
- Server Actions for mutations (cart, wishlist, checkout, auth)
- Route Handlers only where an HTTP endpoint is needed
- Zod for input validation on both client and server

## Auth

- In-house session module (`src/lib/auth/`) with email + password — no auth library
- Opaque database sessions: random token in an HttpOnly `__Host-stride_session` cookie, only its SHA-256 hash stored in Postgres
- Passwords hashed with Argon2id + per-user salt + server-side pepper (`@node-rs/argon2`)
- Rules for using it: `standards/global/auth-security.md`

## Database

- PostgreSQL hosted on Neon (serverless Postgres)
- Prisma 6 ORM (pinned major; Prisma 7 moves `directUrl` to `prisma.config.ts` and needs a driver adapter) with migrations and a seed script for the product catalog
  - Catalog content lives in one shared catalog data file, imported by both the seed script and the production catalog load
  - Neon needs two connection strings: pooled `DATABASE_URL` for the app at runtime, and unpooled `DIRECT_URL` (`directUrl` in `schema.prisma`) for `prisma migrate`
  - Migrations stay backward-compatible with the previous deploy (expand → contract), so a Vercel rollback never needs a database rollback
- Neon branch per preview deployment: each PR preview gets its own database branch, forked from the `develop` database branch, so preview data and migrations stay isolated
  - CI/preview build runs `prisma migrate deploy` then the seed script against that preview's branch
  - Production runs migrations only, never the seed script. The seed script refuses to run against the production database.
  - Exception: production catalog content is loaded by a dedicated, idempotent catalog load (upserts keyed by slug) that reads the shared catalog data file. It loads catalog data only, never test users, orders or other fixture data.
  - The preview branch is deleted when the PR closes

## Testing

- Vitest + React Testing Library for unit/component tests
- Playwright for end-to-end tests of the shopping flow

## Other

- Vercel hosting, with preview deployments per PR
- GitHub Actions CI: lint, typecheck, tests on every PR
- Product images stored in the repo under `/public`
- Payment is mocked (no real payment provider)
- Figma as design source of truth (via MCP); Google Stitch for UI generation
- TypeScript strict mode; ESLint + Prettier
- Server-render by default; client components only where interaction requires it
