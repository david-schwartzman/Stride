# Stride — Tech Stack

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
- Auth: Auth.js (NextAuth) with email + password credentials, passwords hashed with bcrypt, session stored in an httpOnly cookie

## Data

- PostgreSQL hosted on Neon (serverless Postgres)
- Prisma ORM with migrations and a seed script for the product catalog
- Neon branch per preview deployment: each PR preview gets its own database branch, forked from the `develop` database branch, so preview data and migrations stay isolated
  - CI/preview build runs `prisma migrate deploy` then the seed script against that preview's branch
  - Production runs migrations only, never the seed script
  - The preview branch is deleted when the PR closes

## Infra & Services

- Vercel for hosting, with preview deployments per PR
- GitHub for repo and PRs; GitHub Actions CI (lint, typecheck, tests on every PR)
- Product images stored in the repo under `/public`
- Payment is mocked (no real payment provider)
- Figma as design source of truth (via MCP)
- Google Stitch for UI generation

## Testing

- Vitest + React Testing Library for unit/component tests
- Playwright for end-to-end tests of the shopping flow

## Conventions

- TypeScript strict mode
- ESLint + Prettier
- SoftwareOS spec-driven workflow
- Branch off `develop` and open every PR against `develop` (mentor's convention for the capstone); `main` is not a PR target
- Branches: `feat/<epic>/<spec>`, `hotfix/<epic>/<bug>`, `chore/<slug>`
- PR titles use conventional-commit prefixes (`feat(<epic>):`, `fix(<epic>):`, `chore:`)
- Every change merged through a reviewed PR
- Server-render by default; client components only where interaction requires it
