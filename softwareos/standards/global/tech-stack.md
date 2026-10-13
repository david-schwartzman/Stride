# Tech Stack

## Frontend

- Next.js (App Router) with React and TypeScript
- Tailwind CSS for styling
- `next/image` for optimized product images

## Backend

- Separate NestJS API (`apps/api`) in the same npm-workspaces monorepo as the Next.js frontend (`apps/web`); shared Zod schemas and types in `packages/shared`
- **Boundary rule:** `apps/web` never imports Prisma, `@node-rs/argon2` or any secret. All data goes through the API. If a page needs data that no endpoint returns, add an endpoint
- The browser reaches the API only through the same-origin `/api/*` rewrite, which the web proxy does (not `next.config`, so it can add the trusted proxy headers and strip the `/api` prefix); Server Components call it server-to-server at `API_URL` with the same headers (see `auth-security.md`, Requests)
- **Deploy order:** web and API don't deploy atomically. The API ships first, and every API change stays backward-compatible with the web deploy in production; remove old endpoints or fields only in a later deploy
- Server Components load data through the API; client forms send writes to `/api/*` — no Server Actions for data
- Zod for input validation on both client and server, from `packages/shared`

## Auth

- In-house auth module in the API (`apps/api/src/auth/`) with email + password — no auth library
- Opaque database sessions: random token in an HttpOnly `__Host-stride_session` cookie, only its SHA-256 hash stored in Postgres
- Passwords hashed with Argon2id + per-user salt + server-side pepper (`@node-rs/argon2`)
- Rules for using it: `standards/global/auth-security.md`

## Database

- PostgreSQL hosted on Neon (serverless Postgres), connected to the API project only
- Prisma 6 (in `apps/api`) ORM (pinned major; Prisma 7 moves `directUrl` to `prisma.config.ts` and needs a driver adapter) with migrations and a seed script for the product catalog
  - Catalog content lives in one shared catalog data file, imported by both the seed script and the production catalog load
  - Neon needs two connection strings: pooled `DATABASE_URL` for the API at runtime, and unpooled `DIRECT_URL` (`directUrl` in `schema.prisma`) for `prisma migrate`
  - Migrations stay backward-compatible with the previous deploy (expand → contract), so a Vercel rollback (of either project) never needs a database rollback
- Neon branch per preview deployment: each PR preview gets its own database branch, forked from the `develop` database branch, so preview data and migrations stay isolated
  - The API project's CI/preview build runs `prisma migrate deploy` then the seed script against that preview's branch
  - Production runs migrations only, never the seed script. The seed script refuses to run against the production database.
  - Exception: production catalog content is loaded by a dedicated, idempotent catalog load (upserts keyed by slug) that reads the shared catalog data file. It loads catalog data only, never test users, orders or other fixture data.
  - The preview branch is deleted when the PR closes

## Testing

- Vitest + React Testing Library for unit/component tests
- Playwright for end-to-end tests of the shopping flow

## Other

- Vercel hosting: two projects (web, API), each with preview deployments per PR. Goal: a web preview calls the API preview from the same commit. The mechanism (and the Deployment Protection bypass) is settled by the `api-foundation` spike; until then a web preview may call the shared `develop` API preview
- GitHub Actions CI: lint, typecheck, tests on every PR
- Product images stored in the repo under `/public`
- Payment is mocked (no real payment provider)
- Figma as design source of truth (via MCP); Google Stitch for UI generation
- TypeScript strict mode; ESLint + Prettier
- Server-render by default; client components only where interaction requires it
