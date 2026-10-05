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
- Branches: `feat/<epic>/<spec>`, `hotfix/<epic>/<bug>`, `chore/<slug>`
- Every change merged through a reviewed PR
- Server-render by default; client components only where interaction requires it
