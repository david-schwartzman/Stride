# Tasks — API Foundation

> Epic: accounts-auth
> Spec: 2026-10-13-api-foundation
> Branch: feat/accounts-auth/api-foundation

## Gate & spike

- [~] T1 Dependency gate: confirm PR #20 (signup-login) is merged into `develop` (human). Rebase `feat/accounts-auth/api-foundation` onto `develop`. Record a green baseline of `npm run lint`, `typecheck`, `test` and `test:e2e` (including `e2e/auth.spec.ts`) as the no-regression reference (AC2, AC11)
  - Baseline recorded 2026-10-13 on `feat/accounts-auth/auth-api-demo` (PR #20 and #21 merged into the branch, not yet into `develop` — the gate itself is deferred for the demo): lint ✓, typecheck ✓, `test` 164 passed / 8 skipped (Postgres-only `*.db.test.ts`, no `TEST_DATABASE_URL`), `test:e2e` 5 passed, plus `e2e/auth.spec.ts` 3 passed against the Neon demo branch (`TEST_DATABASE_URL` set to un-skip)
- [ ] T2 **Deferred (demo — local-only build on feat/accounts-auth/auth-api-demo).** Spike, on a throwaway branch: a minimal NestJS app behind a web proxy (`proxy.ts`) that rewrites `/api/*` with `NextResponse.rewrite` and added request headers, deployed to Vercel previews. Record the results in `spike-notes.md` in this spec folder before starting T3. Also record whether `next.config.ts` `headers()` reach proxied `/api/*` responses (AC4, AC9, AC12, AC15)
- [ ] T2.1 **Deferred (demo — local-only build on feat/accounts-auth/auth-api-demo).** Preview pairing: compare two linked Vercel projects (the proxy derives the API preview's branch URL from `VERCEL_GIT_COMMIT_REF`) with Vercel Services. Aim for a web preview that reaches the API preview from the same commit through `/api`, with both on the same Neon preview branch. Prove that the proxy's `x-vercel-protection-bypass` gets past the API preview's Deployment Protection. If neither option works with reasonable setup, record the fallback (web previews call the shared `develop` API preview) and why. Record the chosen setup (human for the Vercel/Neon dashboard parts) (AC12)
- [ ] T2.2 **Deferred (demo — local-only build on feat/accounts-auth/auth-api-demo).** Trusted proxy headers: deploy an echo endpoint on the spike API that returns the `x-stride-*` headers it received (the spike branch is never merged). Call it through the web proxy and record:
  - that `x-stride-client-ip` equals the browser's real IP (Vercel's `x-real-ip` at the web edge), including when the browser sends a spoofed `x-stride-client-ip` or `x-real-ip`
  - that two clients on different networks show different IPs
  - that `x-stride-forwarded-host` is the web preview's host and the secret arrives intact
  - that a direct call to the API's own domain without the secret gets 401

  (AC9, AC14, AC15)

## Workspaces & move

- [x] T3 `git mv` `src/`, `public/`, `e2e/`, `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `vitest.config.ts`, `vitest.setup.ts`, `eslint.config.mjs` and `playwright.config.ts` into `apps/web/`. Create `apps/web/package.json` (name `@stride/web`) with the Next/React/zod dependencies and the scripts dev, build, start, lint, typecheck, test and test:e2e. `stride-design/` stays at the root (AC2)
- [x] T4 Rewrite the root `package.json`, then regenerate the single root `package-lock.json` and delete the stale root `tsconfig.tsbuildinfo` (AC1):
  - add `"workspaces": ["apps/*", "packages/*"]`
  - keep the shared devDeps at the root (typescript, eslint, prettier, vitest, @types/node) and add `concurrently`
  - make the root build, lint, typecheck and test scripts fan out with `--workspaces --if-present`
  - point `test:e2e` at `-w apps/web`
  - remove the root postinstall and db:* scripts (they move in T9)
- [x] T5 Add a root `tsconfig.base.json` with the shared compiler options. `apps/web/tsconfig.json` extends it and keeps the `@/*` → `./src/*` path alias (AC1, AC2)
- [x] T6 Fix ignore and format config (AC1):
  - `.gitignore`: drop the leading slashes (`/node_modules`, `/.next/`, `/out/`, `/build`, `/coverage`, `/test-results/`, …) so they also match inside `apps/*`
  - keep the Prettier config and `.prettierignore` at the root, covering `apps/*` and `packages/*` and excluding `stride-design/**`
- [x] T7 Move checkpoint: web lint, typecheck, test and test:e2e from the root match the T1 baseline. Spot-check after login that the session cookie name, flags and path are unchanged (AC2)
  - Checkpoint 2026-10-13: from the root — lint ✓, typecheck ✓, test 164 passed / 8 skipped, test:e2e 8 passed (incl. auth.spec.ts against the Neon demo branch); matches T1. Cookie code unchanged (only paths moved); auth e2e asserts the `__Host-stride_session` cookie

## API scaffold

- [x] T8 Scaffold `apps/api` (name `@stride/api`, `engines.node` 24) (AC1, AC3):
  - NestJS 11 with `@nestjs/platform-express` and `nest-cli.json`
  - `tsconfig.json` extending `tsconfig.base.json` (`experimentalDecorators`, `emitDecoratorMetadata`)
  - `src/main.ts`: `PORT`, default 4000; `enableShutdownHooks()`
  - `src/app.module.ts` and `apps/api/eslint.config.mjs`
  - `apps/api/vitest.config.ts` using `unplugin-swc` in a node environment
  - scripts dev, build, start, lint, typecheck and test

## Prisma move

- [x] T9 Move Prisma into the API (AC5):
  - `git mv prisma/ apps/api/prisma/`, keeping the schema and every migration, including `*_init_auth`
  - move `prisma` and `@prisma/client` (6.19.3) into `apps/api/package.json`, with `postinstall: prisma generate`, `db:migrate` and `db:generate`
  - make the root `db:*` scripts forward via `-w @stride/api`
  - confirm the root `prisma/` folder is gone
- [x] T10 Temporary exception: add `@prisma/client` to `apps/web/package.json` at the same pinned version, so `apps/web/src/lib/db.ts` resolves the hoisted generated client. Confirm signup-login's actions still typecheck and run. Add a comment in `db.ts` naming candidate `auth-api-migration` (AC5, AC6)
- [x] T11 Add `apps/api/src/prisma/prisma.service.ts` (extends `PrismaClient`; `$connect` in `onModuleInit`; disconnects on shutdown) and `apps/api/src/prisma/prisma.module.ts` (global export). Import the module in `AppModule` (AC3)

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
- [ ] T34 Add `apps/api/src/common/proxy-secret.middleware.ts`: compare `x-stride-proxy-secret` with `WEB_PROXY_SECRET` using `crypto.timingSafeEqual` after a length check; reject with 401 and an empty body when it's missing, wrong, or `WEB_PROXY_SECRET` is unset; skip `/cron/*`. Register it first in `AppModule.configure()` for all routes, before the origin check. T36 goes green (AC13)
- [ ] T15 Add `apps/api/src/common/origin-check.middleware.ts`. For POST/PUT/PATCH/DELETE, `Origin` must equal `https://` + `x-stride-forwarded-host` (`http://` also accepted when `NODE_ENV` isn't `production`). A mismatching or missing `Origin`, or a missing forwarded host, → 403, and the handler never runs; GET/HEAD pass. Apply it to all routes in `AppModule.configure()` with `forRoutes('*')`, after the T34 proxy-secret middleware (AC8)
- [ ] T16 Add `apps/api/src/common/request-ip.ts`, exporting `getClientIp(req)`. It reads only `x-stride-client-ip` (trusted because T34 runs first), validates the value with `node:net` `isIP`, and returns `null` for a missing or invalid value. It never reads `x-forwarded-for`, `x-real-ip` or the socket address (AC9)

## Web wiring

- [ ] T35 Add `apps/web/src/lib/api-proxy.ts` `trustedProxyHeaders(incoming: Headers): Headers`: copy the incoming headers, delete every `x-stride-*`, then set `x-stride-proxy-secret` (`WEB_PROXY_SECRET`), `x-stride-client-ip` from the web's `getClientIp(headers)` (`src/lib/request-ip.ts`, #20; omitted when null) and `x-stride-forwarded-host` (`Host`). Add `apps/web/src/lib/api-client.ts` (`import "server-only"`) with `apiFetch(path, init)`, which calls `${API_URL}${path}` with `trustedProxyHeaders(await headers())` and the incoming `Cookie`. T36 goes green (AC14)
- [ ] T17 Wire the `/api` rewrite in the web proxy, not in `next.config.ts` (AC4, AC10, AC12):
  - `apps/web/src/lib/api-proxy.ts`: `apiRewrite(request)` strips `/api`, keeps the query, and returns `NextResponse.rewrite(\`${API_URL}${path}\`, { request: { headers: trustedProxyHeaders(request.headers) } })` (T35), passing the whole `Cookie` header through. On Preview it adds `x-vercel-protection-bypass` when `API_PROTECTION_BYPASS_SECRET` is set
  - outside production, `API_URL` defaults to `http://localhost:4000`; in production a missing `API_URL` or `WEB_PROXY_SECRET` makes `/api/*` answer 503 and logs the variable name only
  - create `apps/web/src/proxy.ts` (Next 16.4) as a thin adapter: matcher includes `/api/:path*`, `/api/*` → `apiRewrite`, everything else → `NextResponse.next()`. This is a wiring edit, not claimed: protected-routes owns the file and later adds the page guard
- [ ] T18 Add a `no-restricted-imports` rule in `apps/web/eslint.config.mjs` for `@prisma/client` and `@/lib/db` (AC6):
  - an override allows them only in `src/lib/db.ts`, `src/lib/auth/**`, `src/features/auth/actions.ts` and `src/features/auth/actions.test.ts` (#20's action tests import the db module)
  - a comment names candidate `auth-api-migration`
  - `npm run lint` passes on the existing auth files, and an import anywhere else fails

## Local dev & env

- [ ] T19 Set the root `dev` script to `concurrently -n web,api -c auto "npm run dev -w @stride/web" "npm run dev -w @stride/api"`. Confirm web runs on :3000 and the API on :4000, and that `curl localhost:3000/api/health` returns the API's body (AC4, AC10)
- [ ] T20 Replace the root `.env.example` with one per app (AC10):
  - `apps/api/.env.example`: `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET`, `WEB_PROXY_SECRET`
  - `apps/web/.env.example`: `API_URL=http://localhost:4000`, `WEB_PROXY_SECRET` (same local value as the API's), plus `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER` and `TEST_DATABASE_URL` marked `# TEMPORARY until auth-api-migration`
  - each developer moves their local `.env` into the matching app folder (human, per machine)

## CI & e2e

- [ ] T21 Start both apps in Playwright and add an API smoke test (AC4, AC11):
  - in `apps/web/playwright.config.ts`, make `webServer` an array: the API on :4000 first (ready check `http://localhost:4000/health`; Playwright counts the 401 from T34 as ready), then web on :3000 with `API_URL=http://localhost:4000`. Both get the same test `WEB_PROXY_SECRET`
  - add `apps/web/e2e/api-health.spec.ts`, asserting that `GET /api/health` on the web origin returns 200 with the shared schema
- [ ] T22 **Deferred (demo — local-only build on feat/accounts-auth/auth-api-demo).** Update `.github/workflows/ci.yml` as a single job, on Node 24 with the `postgres:16` service from PR #20 (AC11):
  - steps, in order: `npm ci` → `npx prisma migrate deploy` in `apps/api` → root lint, typecheck and test (all workspaces) → build both apps → `playwright install` → `test:e2e` (both apps, including `e2e/auth.spec.ts`)
  - env: `DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET`, `WEB_PROXY_SECRET` (a CI-only value), `API_URL`

## Vercel

- [ ] T23 **Deferred (demo — local-only build on feat/accounts-auth/auth-api-demo).** Split the Vercel config by app (AC5, AC12):
  - add `apps/api/vercel.json` with build command `DIRECT_URL="${DIRECT_URL:-$DATABASE_URL_UNPOOLED}" prisma migrate deploy && nest build`, plus the Nest entry/function config the spike proved in T2.1
  - move the root `vercel.json` to `apps/web/vercel.json` with `framework: nextjs` and a plain `next build`, so the web build no longer migrates
- [ ] T24 **Deferred (demo — local-only build on feat/accounts-auth/auth-api-demo).** (human) In Vercel, apply the setup chosen in T2.1 (AC10, AC12):
  - web project: Root Directory `apps/web`
  - API project (create or configure): Root Directory `apps/api`
  - follow `INFRA_PLAN.md` step D2: create and deploy the API project first (deploy order), then move the web Root Directory
  - attach the Neon integration so both get the same preview branch (the web still needs it for the temporary auth code)
  - set the AC10 env vars on each: `WEB_PROXY_SECRET` with the same value on both and a different one per environment; `PASSWORD_PEPPER` and `GUEST_CART_SECRET` copied with the **same** values; on web, `API_URL` per the T2.1 result and `API_PROTECTION_BYPASS_SECRET` on Preview
- [ ] T25 **Deferred (demo — local-only build on feat/accounts-auth/auth-api-demo).** (human-assisted) Push the branch and verify the preview: `GET <web-preview>/api/health` returns the API's 200 body, needs no CORS headers and makes no cross-origin browser request. A direct `GET <api-preview>/health` without the secret gets 401. Both deployments come from the same commit and the same Neon branch, or the AC12 fallback is in place. Record the URLs in `spike-notes.md` (AC4, AC12, AC13, AC15)

## Docs

- [ ] T26 **Deferred (demo — local-only build on feat/accounts-auth/auth-api-demo).** Update `softwareos/products/stride/architecture.md` (AC6, AC9, AC12). The trusted proxy headers, the client-IP rule and pairing-as-a-goal are already there (PR #21):
  - Environments: replace the pairing goal with what T2.1 chose (or the fallback)
  - Trusted proxy headers and the client-IP Gotcha: change only what T2.2 contradicted
  - Gotchas: the temporary Prisma-in-web exception, linked to `auth-api-migration`
- [ ] T27 **Deferred (demo — local-only build on feat/accounts-auth/auth-api-demo).** Update `INFRA_PLAN.md`. Step D2 already creates the API project (PR #21); add the T2.1 result (projects or Services), build commands (migrate only in the API), the env var matrix, including `WEB_PROXY_SECRET` and `API_PROTECTION_BYPASS_SECRET`, and Neon branch pairing (AC5, AC10, AC12)
- [ ] T28 **Deferred (demo — local-only build on feat/accounts-auth/auth-api-demo).** Add the `apps/web/` prefix to every accounts-auth spec's Covers paths, then run `/refresh-indexes` (AC2):
  - protected-routes, session-management and auth-event-logging are already done (PR #21); edit security-headers directly
  - edit the done specs `2026-10-08-app-foundation` and `2026-10-08-signup-login` through `/spec-changes`

## Verification

- [ ] T29 Write unit tests (testing skill) for the health endpoint and the shared schema (AC3, AC7):
  - `apps/api/src/health/health.controller.test.ts`: `SELECT 1` succeeds → 200 ok; Prisma throws → 503 down; the body has no error text or secrets
  - parse tests for the `packages/shared` schema
  - one `apps/web` test that imports `healthResponseSchema` from `@stride/shared`
- [ ] T30 Write unit tests (testing skill) for the common API middleware (AC8, AC9):
  - `origin-check.middleware.test.ts`: POST/PUT/PATCH/DELETE with matching, mismatching and missing Origin; GET/HEAD pass; the handler isn't called on 403
  - `origin-check.middleware.test.ts` also covers a missing `x-stride-forwarded-host` and `http://` in and out of production
  - `request-ip.test.ts`: valid IPv4/IPv6 in `x-stride-client-ip`, garbage, empty, a missing header, and a request carrying only `x-forwarded-for` or `x-real-ip` (→ null)
- [ ] T31 Write config and regression tests (testing skill) for the web wiring (AC2, AC4, AC6, AC10, AC11):
  - `apiRewrite`: `/api` stripped, query kept, `Cookie` passed through, bypass header only on Preview with the secret set, and the production 503 when `API_URL` or `WEB_PROXY_SECRET` is missing
  - `next.config.ts` has no `/api` rewrite
  - an ESLint fixture check that `@prisma/client` outside the allowed files is an error
  - confirm the full web suite and e2e (including `auth.spec.ts` and `api-health.spec.ts`) pass from the root
- [ ] T36 Write unit tests first (testing skill) for the trusted proxy headers (AC13, AC14):
  - `proxy-secret.middleware.test.ts`: valid, wrong, missing and different-length secret; unset `WEB_PROXY_SECRET` rejects everything; `/cron/*` exempt; 401 body empty and the handler never runs
  - `api-proxy.test.ts`: client-sent `x-stride-*` headers replaced; a null IP omits `x-stride-client-ip`; `x-stride-forwarded-host` from `Host`
  - `api-client.test.ts`: `apiFetch` calls `API_URL` with the trusted headers and the incoming `Cookie`
- [ ] T32 **Deferred (demo — local-only build on feat/accounts-auth/auth-api-demo).** Security review (security-reviewer agent) of `proxy-secret.middleware.ts`, `origin-check.middleware.ts`, `request-ip.ts`, `api-proxy.ts`, `api-client.ts`, the health response body, and the split of env vars across the apps (AC3, AC8, AC9, AC10, AC13, AC14)
- [ ] T33 **Deferred (demo — local-only build on feat/accounts-auth/auth-api-demo).** Run QA against acceptance criteria AC1–AC15 (qa skill)
