# Tasks — API Foundation

> Epic: accounts-auth
> Spec: 2026-10-13-api-foundation
> Branch: feat/accounts-auth/api-foundation

## Gate & spike

- [ ] T1 Dependency gate: confirm PR #20 (signup-login) is merged into `develop` (human). Rebase `feat/accounts-auth/api-foundation` onto `develop`. Record a green baseline of `npm run lint`, `typecheck`, `test` and `test:e2e` (including `e2e/auth.spec.ts`) as the no-regression reference (AC2, AC11)
- [ ] T2 Spike, on a throwaway branch: a minimal NestJS app behind the Next `/api/:path*` rewrite, deployed to a Vercel preview. Record the results in `spike-notes.md` in this spec folder before starting T3 (AC4, AC9, AC12)
- [ ] T2.1 Preview pairing: compare two Vercel projects (web + API, a Root Directory each) with Vercel Services. Prove that a web preview reaches the API preview from the same commit through `/api`, and that both use the same Neon preview branch. Record the chosen setup and why (human for the Vercel/Neon dashboard parts) (AC12)
- [ ] T2.2 Client-IP header: deploy an echo endpoint on the API and call it through the web rewrite. Record:
  - which header (`x-forwarded-for`, `x-real-ip` or `x-vercel-forwarded-for`) carries the real client IP when it reaches the API
  - whether the rewrite hop appends to it or overwrites it
  - what a client-supplied spoofed value looks like there

  (AC9)

## Workspaces & move

- [ ] T3 `git mv` `src/`, `public/`, `e2e/`, `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `vitest.config.ts`, `vitest.setup.ts`, `eslint.config.mjs` and `playwright.config.ts` into `apps/web/`. Create `apps/web/package.json` (name `@stride/web`) with the Next/React/zod dependencies and the scripts dev, build, start, lint, typecheck, test and test:e2e. `stride-design/` stays at the root (AC2)
- [ ] T4 Rewrite the root `package.json`, then regenerate the single root `package-lock.json` and delete the stale root `tsconfig.tsbuildinfo` (AC1):
  - add `"workspaces": ["apps/*", "packages/*"]`
  - keep the shared devDeps at the root (typescript, eslint, prettier, vitest, @types/node) and add `concurrently`
  - make the root build, lint, typecheck and test scripts fan out with `--workspaces --if-present`
  - point `test:e2e` at `-w apps/web`
  - remove the root postinstall and db:* scripts (they move in T9)
- [ ] T5 Add a root `tsconfig.base.json` with the shared compiler options. `apps/web/tsconfig.json` extends it and keeps the `@/*` → `./src/*` path alias (AC1, AC2)
- [ ] T6 Fix ignore and format config (AC1):
  - `.gitignore`: drop the leading slashes (`/node_modules`, `/.next/`, `/out/`, `/build`, `/coverage`, `/test-results/`, …) so they also match inside `apps/*`
  - keep the Prettier config and `.prettierignore` at the root, covering `apps/*` and `packages/*` and excluding `stride-design/**`
- [ ] T7 Move checkpoint: web lint, typecheck, test and test:e2e from the root match the T1 baseline. Spot-check after login that the session cookie name, flags and path are unchanged (AC2)

## API scaffold

- [ ] T8 Scaffold `apps/api` (name `@stride/api`, `engines.node` 24) (AC1, AC3):
  - NestJS 11 with `@nestjs/platform-express` and `nest-cli.json`
  - `tsconfig.json` extending `tsconfig.base.json` (`experimentalDecorators`, `emitDecoratorMetadata`)
  - `src/main.ts`: `PORT`, default 4000; `enableShutdownHooks()`
  - `src/app.module.ts` and `apps/api/eslint.config.mjs`
  - `apps/api/vitest.config.ts` using `unplugin-swc` in a node environment
  - scripts dev, build, start, lint, typecheck and test

## Prisma move

- [ ] T9 Move Prisma into the API (AC5):
  - `git mv prisma/ apps/api/prisma/`, keeping the schema and every migration, including `*_init_auth`
  - move `prisma` and `@prisma/client` (6.19.3) into `apps/api/package.json`, with `postinstall: prisma generate`, `db:migrate` and `db:generate`
  - make the root `db:*` scripts forward via `-w @stride/api`
  - confirm the root `prisma/` folder is gone
- [ ] T10 Temporary exception: add `@prisma/client` to `apps/web/package.json` at the same pinned version, so `apps/web/src/lib/db.ts` resolves the hoisted generated client. Confirm signup-login's actions still typecheck and run. Add a comment in `db.ts` naming candidate `auth-api-migration` (AC5, AC6)
- [ ] T11 Add `apps/api/src/prisma/prisma.service.ts` (extends `PrismaClient`; `$connect` in `onModuleInit`; disconnects on shutdown) and `apps/api/src/prisma/prisma.module.ts` (global export). Import the module in `AppModule` (AC3)

## Shared package

- [ ] T12 Create `packages/shared` (name `@stride/shared`) (AC7):
  - `package.json`, and a `tsconfig.json` extending the base
  - `src/health.ts`: a zod `healthResponseSchema` for `{status:"ok",db:"ok"}` | `{status:"error",db:"down"}`, plus the inferred `HealthResponse` type
  - `src/index.ts`
  - decide how the apps consume it: the TS source (via Next `transpilePackages` and swc in the API) or a `tsc` build to `dist`. If it needs a build, make `npm run build` order it before both apps
- [ ] T13 Add `@stride/shared` as a dependency of `apps/api` and `apps/web`. If the apps consume the source, also add `transpilePackages: ["@stride/shared"]` in `apps/web/next.config.ts` (AC7)

## API endpoints & common

- [ ] T14 Add `apps/api/src/health/health.module.ts` and `health.controller.ts`, and import the module in `AppModule` (AC3, AC7):
  - `GET /health` runs `SELECT 1` via `PrismaService`
  - success: 200 `{status:"ok",db:"ok"}`
  - failure: 503 `{status:"error",db:"down"}`, with no error message, connection string or stack in the body
  - typed with `HealthResponse` from `@stride/shared`
- [ ] T15 Add `apps/api/src/common/origin-check.middleware.ts`, reading `WEB_ORIGIN` from config. POST/PUT/PATCH/DELETE with a mismatching or missing `Origin` → 403, and the handler never runs; GET/HEAD pass. Apply it to all routes in `AppModule.configure()` with `forRoutes('*')` (AC8)
- [ ] T16 Add `apps/api/src/common/request-ip.ts`, exporting `getClientIp(req)`. It reads the header proven in T2.2 at the position the spike identified as trustworthy, validates the value with `node:net` `isIP`, and returns `null` for a missing or invalid value (AC9)

## Web wiring

- [ ] T17 Add `rewrites()` in `apps/web/next.config.ts` mapping `/api/:path*` → `${API_URL}/:path*` (AC4, AC10):
  - outside production, `API_URL` defaults to `http://localhost:4000`
  - with `NODE_ENV=production` and no `API_URL`, the build fails with a clear error
  - this is a wiring edit to an app-foundation file, so keep the existing headers and config intact
- [ ] T18 Add a `no-restricted-imports` rule in `apps/web/eslint.config.mjs` for `@prisma/client` and `@/lib/db` (AC6):
  - an override allows them only in `src/lib/db.ts`, `src/lib/auth/**` and `src/features/auth/actions.ts`
  - a comment names candidate `auth-api-migration`
  - `npm run lint` passes on the existing auth files, and an import anywhere else fails

## Local dev & env

- [ ] T19 Set the root `dev` script to `concurrently -n web,api -c auto "npm run dev -w @stride/web" "npm run dev -w @stride/api"`. Confirm web runs on :3000 and the API on :4000, and that `curl localhost:3000/api/health` returns the API's body (AC4, AC10)
- [ ] T20 Replace the root `.env.example` with one per app (AC10):
  - `apps/api/.env.example`: `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET`, `WEB_ORIGIN=http://localhost:3000`
  - `apps/web/.env.example`: `API_URL=http://localhost:4000`, plus `DATABASE_URL` and `PASSWORD_PEPPER` marked `# TEMPORARY until auth-api-migration`
  - each developer moves their local `.env` into the matching app folder (human, per machine)

## CI & e2e

- [ ] T21 Start both apps in Playwright and add an API smoke test (AC4, AC11):
  - in `apps/web/playwright.config.ts`, make `webServer` an array: the API on :4000 first (ready check `http://localhost:4000/health`), then web on :3000 with `API_URL=http://localhost:4000`
  - add `apps/web/e2e/api-health.spec.ts`, asserting that `GET /api/health` on the web origin returns 200 with the shared schema
- [ ] T22 Update `.github/workflows/ci.yml` as a single job, on Node 24 with the `postgres:16` service from PR #20 (AC11):
  - steps, in order: `npm ci` → `npx prisma migrate deploy` in `apps/api` → root lint, typecheck and test (all workspaces) → build both apps → `playwright install` → `test:e2e` (both apps, including `e2e/auth.spec.ts`)
  - env: `DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET`, `WEB_ORIGIN`, `API_URL`

## Vercel

- [ ] T23 Split the Vercel config by app (AC5, AC12):
  - add `apps/api/vercel.json` with build command `DIRECT_URL="${DIRECT_URL:-$DATABASE_URL_UNPOOLED}" prisma migrate deploy && nest build`, plus the Nest entry/function config the spike proved in T2.1
  - move the root `vercel.json` to `apps/web/vercel.json` with `framework: nextjs` and a plain `next build`, so the web build no longer migrates
- [ ] T24 (human) In Vercel, apply the setup chosen in T2.1 (AC10, AC12):
  - web project: Root Directory `apps/web`
  - API project (create or configure): Root Directory `apps/api`
  - attach the Neon integration so both get the same preview branch
  - set the AC10 env vars on each, including `WEB_ORIGIN` per environment and, on web, `API_URL` pointing at the paired API preview
- [ ] T25 (human-assisted) Push the branch and verify the preview: `GET <web-preview>/api/health` returns the API's 200 body, needs no CORS headers and makes no cross-origin browser request. Both deployments come from the same commit and the same Neon branch. Record the URLs in `spike-notes.md` (AC4, AC12)

## Docs

- [ ] T26 Update `softwareos/products/stride/architecture.md` (AC6, AC9, AC12):
  - Environments: the web↔API preview pairing and production layout chosen in T2.1
  - Gotchas: the client-IP header and trust rule proven in T2.2 and used by `getClientIp`
  - Gotchas: the temporary Prisma-in-web exception, linked to `auth-api-migration`
- [ ] T27 Update `INFRA_PLAN.md` with the Vercel setup: projects or Services, Root Directories, build commands (migrate only in the API), the env var matrix, and Neon branch pairing (AC5, AC10, AC12)
- [ ] T28 Add the `apps/web/` prefix to every accounts-auth spec's Covers paths, then run `/refresh-indexes` (AC2):
  - edit `2026-10-11-*` (protected-routes, security-headers, session-management, auth-event-logging) directly
  - edit the done specs `2026-10-08-app-foundation` and `2026-10-08-signup-login` through `/spec-changes`

## Verification

- [ ] T29 Write unit tests (testing skill) for the health endpoint and the shared schema (AC3, AC7):
  - `apps/api/src/health/health.controller.test.ts`: `SELECT 1` succeeds → 200 ok; Prisma throws → 503 down; the body has no error text or secrets
  - parse tests for the `packages/shared` schema
  - one `apps/web` test that imports `healthResponseSchema` from `@stride/shared`
- [ ] T30 Write unit tests (testing skill) for the common API middleware (AC8, AC9):
  - `origin-check.middleware.test.ts`: POST/PUT/PATCH/DELETE with matching, mismatching and missing Origin; GET/HEAD pass; the handler isn't called on 403
  - `request-ip.test.ts`: valid IPv4/IPv6, a multi-hop list, spoofed client-prepended values, garbage, empty, and a missing header
- [ ] T31 Write config and regression tests (testing skill) for the web wiring (AC2, AC4, AC6, AC10, AC11):
  - the `next.config.ts` rewrite destination and the production `API_URL` guard
  - an ESLint fixture check that `@prisma/client` outside the allowed files is an error
  - confirm the full web suite and e2e (including `auth.spec.ts` and `api-health.spec.ts`) pass from the root
- [ ] T32 Security review (security-reviewer agent) of `origin-check.middleware.ts`, `request-ip.ts`, the `/api` rewrite, the health response body, and the split of env vars across the apps (AC3, AC8, AC9, AC10)
- [ ] T33 Run QA against acceptance criteria AC1–AC12 (qa skill)
