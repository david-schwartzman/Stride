# API Foundation

> Epic: ../../epic.md
> Status: shaped
> Branch: feat/accounts-auth/api-foundation
> Covers: package.json, package-lock.json, tsconfig.base.json, apps/web/package.json, apps/api/package.json, apps/api/nest-cli.json, apps/api/tsconfig.json, apps/api/vercel.json, apps/api/.env.example, apps/api/src/main.ts, apps/api/src/app.module.ts, apps/api/src/health/**, apps/api/src/prisma/**, apps/api/src/common/**, apps/api/prisma/schema.prisma, packages/shared/package.json, packages/shared/tsconfig.json, packages/shared/src/index.ts, .github/workflows/**, playwright.config.ts

## Overview

First step of the 2026-10-13 architecture decision (a separate NestJS backend, see `../../../../architecture.md`). It turns the single Next.js app into an npm-workspaces monorepo: `apps/web` (the existing Next app, moved), `apps/api` (a new NestJS service that owns Prisma) and `packages/shared`. It wires the same-origin `/api` rewrite, local dev, CI and Vercel for both apps.

This is a **no-regression** spec. Every accounts-auth criterion and test that passes on `develop` before this spec must still pass after the move: app-foundation, plus signup-login once PR #20 merges. The only new behaviour is the API's health endpoint, reachable through `/api` on local dev and on Vercel.

**Depends on PR #20.** Build this only after #20 is on `develop`. That PR adds files this spec also moves:
- `src/lib/auth/**`
- `src/features/auth/**`
- `prisma/migrations/*_init_auth`
- `src/instrumentation.ts`
- `src/lib/request-ip.ts`
- the CI Postgres service

**Temporary boundary exception.** Until candidate `auth-api-migration` moves the auth code into the API, that code keeps using Prisma inside `apps/web`. It goes through `apps/web/src/lib/db.ts`, using the client generated from the API's schema. `auth-api-migration` removes the exception.

## Goals & User Stories

- As a developer, I run one command and get the web app and the API locally, with `/api/*` reaching the API.
- As a developer, I add backend code in `apps/api` and shared schemas in `packages/shared`, and the web app can't accidentally import Prisma outside the one allowed file.
- As a reviewer, every PR gets a web preview and an API preview from the same commit, on the same database branch.
- As a shopper, nothing changes: sign-up, login, logout and the session cookie behave exactly as before.

## Acceptance Criteria

1. AC1: The repo is an npm-workspaces monorepo (`apps/web`, `apps/api`, `packages/shared`) with one root `package-lock.json`. A single `npm ci` at the root installs everything. Root scripts `dev`, `build`, `lint`, `typecheck`, `test` and `test:e2e` run across the workspaces.
2. AC2: `apps/web` contains the whole Next app (src, public, e2e, its configs). Every unit, component and e2e test that passed on `develop` before this spec still passes. Only paths change, not behaviour. Sign-up, login and logout still set and clear the same `__Host-stride_session` cookie (signup-login AC6).
3. AC3: `apps/api` is a NestJS app on Node 24. `GET /health` returns 200 `{ "status": "ok", "db": "ok" }` after a `SELECT 1` through `PrismaService`. It returns 503 `{ "status": "error", "db": "down" }` when the database is unreachable. The body never holds connection strings or error details.
4. AC4: The browser's `GET /api/health` on the web origin returns the API's response through the Next rewrite, locally and on a Vercel preview. No CORS headers are involved, and the browser never calls the API's own domain.
5. AC5: `prisma/schema.prisma` and all migrations live in `apps/api/prisma/`, and the root `prisma/` is gone. `prisma generate` and `prisma migrate` run from `apps/api`. The API's Vercel build runs `prisma migrate deploy`; the web build no longer does.
6. AC6: The temporary exception is enforced. In `apps/web`, only these files may import `@prisma/client` and `@/lib/db`:
   - `apps/web/src/lib/db.ts`
   - the signup-login auth files (`src/lib/auth/**`, `src/features/auth/actions.ts`)

   An ESLint `no-restricted-imports` rule fails lint anywhere else. A comment on the rule names `auth-api-migration` as the spec that removes it.
7. AC7: `packages/shared` is imported by both apps. It holds at least the health response type/schema used by `apps/api` and by a web test. Both builds and typechecks resolve it with no extra publish step.
8. AC8: A global API middleware handles state-changing requests:
   - It rejects any `POST`, `PUT`, `PATCH` or `DELETE` whose `Origin` header doesn't match the allowed web origin (`WEB_ORIGIN`) with 403, and runs no handler. A missing `Origin` counts as not matching.
   - `GET` and `HEAD` pass through.
   - Unit tests cover matching, foreign and missing origins, and the safe methods.
9. AC9: The API's `getClientIp(req)` (`apps/api/src/common/request-ip.ts`) reads the real client IP from the forwarded header that the T2.2 spike proves trustworthy across the `/api` rewrite on Vercel. It validates the value with `isIP` and returns null otherwise. The header choice and the reason are recorded in `architecture.md` Gotchas. Unit tests cover valid, invalid, missing and client-spoofed values.
10. AC10: Local dev works from one command:
    - Root `npm run dev` starts web on :3000 and the API on :4000 together.
    - Web rewrites `/api/*` to `API_URL` (default `http://localhost:4000`).
    - Each app has its own `.env.example`. The API's lists `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET` and `WEB_ORIGIN`. The web's lists `API_URL`, plus `DATABASE_URL` and `PASSWORD_PEPPER` marked "temporary — removed by auth-api-migration".
11. AC11: CI runs, in order:
    - lint, typecheck and unit tests for every workspace
    - `prisma migrate deploy` from `apps/api` against the Postgres service
    - builds of both apps
    - Playwright with both apps started, including signup-login's `e2e/auth.spec.ts` against the real database
12. AC12: The spike proves preview pairing:
    - A PR's web preview reaches the API preview built from the same commit, through `/api`.
    - Both previews use the same Neon preview branch.
    - The chosen setup (two linked Vercel projects, or one project with Vercel Services) is recorded in `architecture.md` Environments and `INFRA_PLAN.md`.

## Technical Approach

- **Spike first (T2).** It answers the two questions everything else depends on, and both answers are recorded in `spike-notes.md` before building past the scaffold:
  - Preview pairing: two projects, or one project with Vercel Services. Pick whichever gives web and API previews a shared commit and Neon branch with the least setup.
  - Which forwarded header the API can trust for the client IP behind the rewrite.
- **Workspaces:**
  - Root `package.json` holds:
    - `"workspaces": ["apps/*", "packages/*"]`
    - the shared devDependencies (TypeScript, ESLint, Prettier, Vitest)
    - `concurrently` for `dev`
    - scripts that fan out with `-w` / `--workspaces --if-present`
  - Root `tsconfig.base.json`; each workspace extends it.
  - Prettier and `.prettierignore` stay at the root.
  - ESLint is configured per app: web keeps the Next presets; the API gets a TypeScript/Node config.
- **Move the web app:**
  - `git mv` these into `apps/web`: `src`, `public`, `e2e`, `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `vitest.config.ts`, `vitest.setup.ts`, `eslint.config.mjs`, `playwright.config.ts`, and the web part of `vercel.json`.
  - `@/*` still maps to `./src/*` from `apps/web/tsconfig.json`.
  - Remove the leading `/` from the root-anchored `.gitignore` entries so they also match inside `apps/*`.
  - `stride-design/` stays at the root (nothing imports it at runtime).
- **Prisma:**
  - `prisma/` moves to `apps/api/prisma/`, and the `postinstall` / `db:*` scripts move to `apps/api`.
  - `apps/api/src/prisma/prisma.service.ts`: `PrismaService extends PrismaClient`, connects on module init and disconnects on shutdown. A `PrismaModule` exports it.
  - The generated client is hoisted, so `apps/web/src/lib/db.ts` keeps working for the exception (AC6).
- **API scaffold:**
  - Nest 11 with `@nestjs/platform-express`.
  - `main.ts` reads `PORT` (default 4000) and enables shutdown hooks.
  - `AppModule` imports `PrismaModule` and `HealthModule`.
  - The `/health` controller runs `SELECT 1` with a short timeout.
  - Tests run on Vitest with `unplugin-swc` for decorator metadata.
- **Common (`apps/api/src/common/`):**
  - `origin-check.middleware.ts` (AC8), applied in `AppModule.configure` for all routes.
  - `request-ip.ts` (AC9).
- **Rewrite:**
  - `apps/web/next.config.ts` adds `rewrites: [{ source: "/api/:path*", destination: \`${process.env.API_URL}/:path*\` }]`.
  - The build fails if `API_URL` is unset in production.
  - This is a wiring edit to app-foundation's file and is not claimed.
- **Vercel:**
  - Web: Root Directory `apps/web`, no migrate step.
  - API: Root Directory `apps/api`; the `apps/api/vercel.json` build runs `prisma migrate deploy` before the Nest build.
  - Env vars follow AC10; `WEB_ORIGIN` is set per environment.
  - The exact pairing mechanism follows the T2 spike.
- **CI:**
  - One job, with the Postgres 16 service from #20.
  - Steps: install, then migrate from `apps/api`, then lint, typecheck and test for all workspaces, then build both apps, then run Playwright.
  - Playwright's `webServer` becomes an array: the API start on :4000, then the web start on :3000 with `API_URL=http://localhost:4000`.
- **Docs (wiring edits):**
  - `architecture.md`: Environments (from the spike), the client-IP Gotcha, and the temporary-exception Gotcha.
  - `INFRA_PLAN.md`: the Vercel setup.
  - Every accounts-auth spec's Covers paths gain the `apps/web/` prefix. The done specs go through `/spec-changes`. Then run `/refresh-indexes`.

## Out of Scope

- Moving the auth code into the API (candidate `auth-api-migration`), including the `AuthGuard`, `GET /auth/me` and removing the AC6 exception.
- Any new feature endpoint beyond `/health`.
- The pepper boot check in the API. It moves with the password code in `auth-api-migration`; `src/instrumentation.ts` stays in `apps/web` until then.
- Updating `.claude/` tooling that assumes a single app (`/verify`, code-reviewer, project-audit). Flagged as a follow-up.
- Production environments (launch-polish `production-deploy`).

## Standards Applied

- [global/tech-stack](../../../../../../standards/global/tech-stack.md): the monorepo layout, the boundary rule (with the documented temporary exception), Prisma 6 on Neon in the API, two Vercel projects, migrate on the API build, Vitest.
- [global/auth-security](../../../../../../standards/global/auth-security.md): secrets live on the API project only (except the temporary web copies, which auth-api-migration removes), the Origin check runs in the API, and no secrets appear in logs or health responses.
- [global/git-workflow](../../../../../../standards/global/git-workflow.md): branch off `develop`, PR to `develop`, `feat(accounts-auth): …` commits.

## Changelog

| Date | Author | Type | Change | Ref |
|---|---|---|---|---|
| 2026-10-13 | david-schwartzman | created | Initial shaping | — |
