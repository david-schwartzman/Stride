# API Foundation

> Epic: ../../epic.md
> Status: in-progress
> Branch: feat/accounts-auth/api-foundation
> Covers: package.json, package-lock.json, tsconfig.base.json, apps/web/package.json, apps/api/package.json, apps/api/nest-cli.json, apps/api/tsconfig.json, apps/api/vercel.json, apps/api/.env.example, apps/api/src/main.ts, apps/api/src/app.module.ts, apps/api/src/app.module.test.ts, apps/api/src/health/**, apps/api/src/prisma/**, apps/api/src/common/**, apps/api/prisma/schema.prisma, apps/web/.env.example, apps/web/src/lib/api-proxy.ts, apps/web/src/lib/api-proxy.test.ts, apps/web/src/lib/api-client.ts, apps/web/src/lib/api-client.test.ts, apps/api/eslint.config.mjs, apps/api/vitest.config.ts, apps/api/tsconfig.build.json, apps/web/vercel.json, apps/web/playwright.config.ts, apps/web/e2e/api-health.spec.ts, apps/web/src/config/*.test.ts, apps/web/src/lib/shared-health.test.ts, packages/shared/package.json, packages/shared/tsconfig.json, packages/shared/tsconfig.build.json, packages/shared/src/index.ts, packages/shared/src/health.ts, packages/shared/src/health.test.ts, .github/workflows/**

## Overview

First step of the 2026-10-13 architecture decision (a separate NestJS backend, see `../../../../architecture.md`). It turns the single Next.js app into an npm-workspaces monorepo: `apps/web` (the existing Next app, moved), `apps/api` (a new NestJS service that owns Prisma) and `packages/shared`. It wires the same-origin `/api` rewrite (done by the web proxy, which adds the trusted proxy headers), local dev, CI and Vercel for both apps.

This is a **no-regression** spec. Every accounts-auth criterion and test that passes on `develop` before this spec must still pass after the move: app-foundation, plus signup-login once PR #20 merges. The only new behaviour is the API's health endpoint, reachable through `/api` on local dev and on Vercel, plus the API's request rules from the PR #21 review: the proxy-secret check, the Origin check against the trusted forwarded host, and the client IP read only after the secret check (`../../../../architecture.md`, Trusted proxy headers).

**Depends on PR #20.** Build this only after #20 is on `develop`. That PR adds files this spec also moves:
- `src/lib/auth/**`
- `src/features/auth/**`
- `prisma/migrations/*_init_auth`
- `src/instrumentation.ts`
- `src/lib/request-ip.ts`
- the CI Postgres service and the Postgres-only `*.db.test.ts` suites (`TEST_DATABASE_URL`)

#20's `src/lib/request-ip.ts` (`getClientIp(headers)` reading Vercel's `x-real-ip`, and `ipThrottleBucket`, which buckets IPv6 per /64) moves to `apps/web` unchanged. It stays correct there: the temporary auth code still runs on the web project, where Vercel sets `x-real-ip`. The web proxy reuses it to fill `x-stride-client-ip`. `auth-api-migration` ports `ipThrottleBucket` into the API with the throttles.

**Temporary boundary exception.** Until candidate `auth-api-migration` moves the auth code into the API, that code keeps using Prisma inside `apps/web`. It goes through `apps/web/src/lib/db.ts`, using the client generated from the API's schema. `auth-api-migration` removes the exception. *(Moved by auth-api-migration: the exception is gone; `apps/web` no longer imports Prisma.)*

## Goals & User Stories

- As a developer, I run one command and get the web app and the API locally, with `/api/*` reaching the API.
- As a developer, I add backend code in `apps/api` and shared schemas in `packages/shared`, and the web app can't accidentally import Prisma outside the one allowed file.
- As a reviewer, every PR gets a web preview and an API preview from the same commit, on the same database branch (the goal; if the spike can't get there, the documented fallback in AC12 applies).
- As the store, the API trusts nothing a direct caller sends: no spoofed client IPs, no cross-site writes, no calls that skip the web app.
- As a shopper, nothing changes: sign-up, login, logout and the session cookie behave exactly as before.

## Acceptance Criteria

1. AC1: The repo is an npm-workspaces monorepo (`apps/web`, `apps/api`, `packages/shared`) with one root `package-lock.json`. A single `npm ci` at the root installs everything. Root scripts `dev`, `build`, `lint`, `typecheck`, `test` and `test:e2e` run across the workspaces.
2. AC2: `apps/web` contains the whole Next app (src, public, e2e, its configs). Every unit, component and e2e test that passed on `develop` before this spec still passes. Only paths change, not behaviour. Sign-up, login and logout still set and clear the same `__Host-stride_session` cookie (signup-login AC6).
3. AC3: `apps/api` is a NestJS app on Node 24. `GET /health` returns 200 `{ "status": "ok", "db": "ok" }` after a `SELECT 1` through `PrismaService`. It returns 503 `{ "status": "error", "db": "down" }` when the database is unreachable. The body never holds connection strings or error details.
4. AC4: The browser's `GET /api/health` on the web origin returns the API's response through the web proxy's rewrite (`apps/web/src/proxy.ts` calling `NextResponse.rewrite`, not a `next.config` rewrite), locally and on a Vercel preview:
   - The proxy strips the `/api` prefix (`/api/health` → `${API_URL}/health`) and passes the whole `Cookie` header through.
   - No CORS headers are involved, and the browser never calls the API's own domain.
   - The spike records whether `next.config.ts` `headers()` reach proxied `/api/*` responses, so security-headers knows whether the API must set them too.
5. AC5: `prisma/schema.prisma` and all migrations live in `apps/api/prisma/`, and the root `prisma/` is gone. `prisma generate` and `prisma migrate` run from `apps/api`. The API's Vercel build runs `prisma migrate deploy`; the web build no longer does.
6. AC6: The temporary exception is enforced. In `apps/web`, only these files may import `@prisma/client` and `@/lib/db`:
   - `apps/web/src/lib/db.ts`
   - the signup-login auth files (`src/lib/auth/**`, `src/features/auth/actions.ts`, `src/features/auth/actions.test.ts`)

   An ESLint `no-restricted-imports` rule fails lint anywhere else. A comment on the rule names `auth-api-migration` as the spec that removes it.

   *(Moved by auth-api-migration: the allowlist and `apps/web/src/lib/db.ts` are removed; no file in `apps/web` may import Prisma.)*
7. AC7: `packages/shared` is imported by both apps. It holds at least the health response type/schema used by `apps/api` and by a web test. Both builds and typechecks resolve it with no extra publish step.
8. AC8: A global API middleware handles state-changing requests:
   - It runs after the proxy-secret check (AC13), so `x-stride-forwarded-host` is trusted.
   - It rejects any `POST`, `PUT`, `PATCH` or `DELETE` whose `Origin` header doesn't equal `https://` + `x-stride-forwarded-host` with 401, and runs no handler. `http://` is accepted only when `NODE_ENV` isn't `production` (local dev; Vercel previews run as production). A missing `Origin` or a missing forwarded host counts as not matching.
   - `GET` and `HEAD` pass through.
   - Unit tests cover matching, foreign and missing origins, a missing forwarded host, `http://` in and out of production, and the safe methods.
9. AC9: The API's `getClientIp(req)` (`apps/api/src/common/request-ip.ts`) returns `x-stride-client-ip`, validated with `isIP`, and null otherwise. It's trusted only because the proxy-secret check (AC13) runs first. It never reads `x-forwarded-for`, `x-real-ip` or the connecting address, which across the rewrite is the web's shared egress IP. Callers treat null as "unknown" and skip per-IP logic (fail open), never one shared bucket. Unit tests cover valid IPv4/IPv6, invalid and missing values, and a request that carries only `x-forwarded-for` or `x-real-ip` (→ null).
10. AC10: Local dev works from one command:
    - Root `npm run dev` starts web on :3000 and the API on :4000 together.
    - The web proxy rewrites `/api/*` to `API_URL` (default `http://localhost:4000`).
    - Each app has its own `.env.example`. The API's lists `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET` and `WEB_PROXY_SECRET`. The web's lists `API_URL` and `WEB_PROXY_SECRET` (the same local value as the API's), plus `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER` and `TEST_DATABASE_URL` marked "temporary — removed by auth-api-migration". *(Moved by auth-api-migration: those temporary web vars are removed.)*
11. AC11: CI runs, in order:
    - `npm ci`, then `prisma migrate deploy` from `apps/api` against the Postgres service (before the unit tests: the Postgres-only suites need the tables)
    - lint, typecheck and unit tests for every workspace
    - builds of both apps
    - Playwright with both apps started, including signup-login's `e2e/auth.spec.ts` against the real database
12. AC12: The spike settles preview pairing, and the result is recorded in `spike-notes.md`, `architecture.md` Environments and `INFRA_PLAN.md`:
    - Goal: a PR's web preview reaches the API preview built from the same commit through `/api`, and both use the same Neon preview branch (the web still needs it for the temporary auth code). The options to compare are two linked projects (the proxy derives the API preview's branch URL from `VERCEL_GIT_COMMIT_REF`) and one project with Vercel Services.
    - Fallback, if neither works with reasonable setup: web previews call the shared `develop` API preview, and the notes record why. Checks of a change that spans both apps then happen after the API PR merges.
    - Either way, a web preview reaches a protected API preview: the proxy and `apiFetch` send `x-vercel-protection-bypass` from `API_PROTECTION_BYPASS_SECRET` (web Preview env only, never `NEXT_PUBLIC_`), through one shared helper.
13. AC13: A global API middleware, registered before every other middleware and guard, rejects any request without a valid `x-stride-proxy-secret` with 401 and an empty body:
    - Valid means equal to `WEB_PROXY_SECRET`, compared in constant time. An unset or empty `WEB_PROXY_SECRET` rejects everything.
    - `/cron/*` is the only exempt path (later specs give it its own Bearer check).
    - Unit tests cover a valid, wrong, missing and different-length secret, an unset `WEB_PROXY_SECRET`, and the cron exemption.
14. AC14: The web sets the trusted proxy headers on every API call, from one function, `trustedProxyHeaders(incoming)` in `apps/web/src/lib/api-proxy.ts`:
    - `x-stride-proxy-secret` (`WEB_PROXY_SECRET`); `x-stride-client-ip` from the web's `getClientIp(headers)` (#20's, Vercel's `x-real-ip`), omitted when null; `x-stride-forwarded-host` from the request's `Host`.
    - Any client-sent `x-stride-*` header is dropped first, so a browser can't spoof one.
    - The proxy uses it for `/api/*`. Server Components use `apiFetch(path, init)` in `apps/web/src/lib/api-client.ts` (`server-only`), which calls `API_URL` with the same headers plus the incoming `Cookie` header. `apiFetch` also:
      - drops caller-supplied `x-stride-*` headers before setting the trusted ones;
      - sends the incoming request's own `Origin` when it has one and no `Origin` otherwise (never one derived from the host);
      - times out after 10 seconds when the caller passes no `signal`;
      - on Preview, sends `x-vercel-protection-bypass` like the proxy (AC12);
      - rejects a `path` that doesn't start with a single `/`, so a caller can't point it at another host.
    - Unit tests cover spoofed `x-stride-*` headers being replaced (from the browser and from an `apiFetch` caller), a null IP omitting the header, the forwarded host, `apiFetch` forwarding the cookie, its `Origin` passed through or absent, its timeout default and its bypass header.
15. AC15: Exit checks, recorded in `spike-notes.md`:
    - On the spike preview (T2.2): the IP the API receives is the browser's real IP even when the browser sends a spoofed `x-stride-client-ip` or `x-real-ip`, and two clients on different networks show different IPs.
    - On this spec's preview (T25): a direct call to the API's own domain without the secret gets 401, while `GET <web-preview>/api/health` returns 200.

## Technical Approach

- **Spike first (T2).** It answers the two questions everything else depends on, and both answers are recorded in `spike-notes.md` before building past the scaffold:
  - Preview pairing: two projects, or one project with Vercel Services. Pick whichever gives web and API previews a shared commit and Neon branch with the least setup.
  - That the trusted-proxy-header design works on Vercel: the proxy can rewrite to the API's external URL with added request headers (including `x-vercel-protection-bypass`), Vercel's `x-real-ip` at the web edge is the real client IP and overwrites a spoofed one, and the API receives the headers unchanged. The header names themselves are already decided (PR #21 review).
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
  - The generated client is hoisted, so `apps/web/src/lib/db.ts` keeps working for the exception (AC6). *(Moved by auth-api-migration: `db.ts` and the exception are removed.)*
- **API scaffold:**
  - Nest 11 with `@nestjs/platform-express`.
  - `main.ts` reads `PORT` (default 4000) and enables shutdown hooks.
  - `AppModule` imports `PrismaModule` and `HealthModule`.
  - The `/health` controller runs `SELECT 1` with a short timeout.
  - Tests run on Vitest with `unplugin-swc` for decorator metadata.
- **Common (`apps/api/src/common/`):**
  - `proxy-secret.middleware.ts` (AC13), applied first in `AppModule.configure` for all routes, using `crypto.timingSafeEqual` after a length check. *(Moved by auth-api-migration: it is now applied in `apps/api/src/setup-app.ts` as the first Express middleware, before body parsing; `AppModule.configure` keeps only the Origin check.)*
  - `origin-check.middleware.ts` (AC8), applied after it for all routes.
  - `request-ip.ts` (AC9).
- **Rewrite (web proxy):**
  - `apps/web/src/lib/api-proxy.ts` (claimed): `trustedProxyHeaders(incoming)` (AC14) and `apiRewrite(request)`, which builds `${API_URL}` + the path without `/api` + the query, and returns `NextResponse.rewrite(url, { request: { headers } })`. On Vercel Preview it also adds `x-vercel-protection-bypass` when `API_PROTECTION_BYPASS_SECRET` is set.
  - `apps/web/src/proxy.ts` (Next 16.4): created here as a thin adapter whose matcher includes `/api/:path*` and which calls `apiRewrite` for `/api/*`. It's a wiring edit, not claimed: protected-routes owns the file and adds the page guard next to the `/api` branch.
  - `apps/web/src/lib/api-client.ts` (claimed, `import "server-only"`): `apiFetch(path, init)` for Server Components (AC14). It shares the Preview bypass helper with `apiRewrite`.
  - `API_URL` and `WEB_PROXY_SECRET` are read at request time. Outside production `API_URL` defaults to `http://localhost:4000`. In production a missing `API_URL` or `WEB_PROXY_SECRET` makes `/api/*` answer 503 and logs the missing variable name (never its value).
  - No `rewrites()` in `next.config.ts`: a config rewrite can't add the trusted headers or the bypass header.
- **Vercel:**
  - Web: Root Directory `apps/web`, no migrate step.
  - API: Root Directory `apps/api`; the `apps/api/vercel.json` build runs `prisma migrate deploy` before the Nest build.
  - Env vars follow AC10 and `INFRA_PLAN.md` step D2: `WEB_PROXY_SECRET` has the same value on both projects and a different one per environment, and `PASSWORD_PEPPER` and `GUEST_CART_SECRET` are copied with the **same** values (a new pepper locks out every account). `API_PROTECTION_BYPASS_SECRET` is set on the web's Preview env.
  - The exact pairing mechanism follows the T2 spike (AC12).
  - **Deploy order** (`standards/global/tech-stack.md`): the API project is deployed and its env set before the web project's Root Directory moves to `apps/web`, so the web never points at an API that isn't live.
- **CI:**
  - One job, with the Postgres 16 service from #20.
  - Steps: install, then migrate from `apps/api`, then lint, typecheck and test for all workspaces, then build both apps, then run Playwright.
  - Playwright's `webServer` becomes an array: the API start on :4000, then the web start on :3000 with `API_URL=http://localhost:4000`. Both get the same CI-only `WEB_PROXY_SECRET`. The API's readiness URL is `http://localhost:4000/health`: Playwright counts a 401 as ready, so `/health` needs no exemption from AC13.
- **Docs (wiring edits):**
  - `architecture.md` already describes the trusted proxy headers, the client-IP rule and preview pairing as a goal (PR #21). Update it only where the spike found something different, settle Environments from the spike, and add the temporary-exception Gotcha.
  - `INFRA_PLAN.md` already has step D2 (PR #21). Fill in the pairing result, build commands and env var matrix from the spike.
  - Covers: protected-routes, session-management and auth-event-logging already use `apps/web/` or `apps/api/` paths (PR #21). Prefix security-headers directly, and app-foundation and signup-login through `/spec-changes`. Then run `/refresh-indexes`.

## Out of Scope

- Moving the auth code into the API (candidate `auth-api-migration`), including the `AuthGuard`, `GET /auth/me` and removing the AC6 exception.
- Any new feature endpoint beyond `/health`.
- Per-IP throttling in the API and porting `ipThrottleBucket` (`auth-api-migration`). This spec only provides `getClientIp(req)`.
- The security headers themselves (security-headers); this spec only records whether they reach `/api/*` (AC4).
- The pepper boot check in the API. It moves with the password code in `auth-api-migration`; `src/instrumentation.ts` stays in `apps/web` until then.
- Updating `.claude/` tooling that assumes a single app (`/verify`, code-reviewer, project-audit). Flagged as a follow-up.
- Production environments (launch-polish `production-deploy`).

## Standards Applied

- [global/tech-stack](../../../../../../standards/global/tech-stack.md): the monorepo layout, the boundary rule (with the documented temporary exception), Prisma 6 on Neon in the API, two Vercel projects, migrate on the API build, Vitest.
- [global/auth-security](../../../../../../standards/global/auth-security.md): secrets live on the API project only (except the temporary web copies, which auth-api-migration removes), the API rejects calls without the web proxy secret, reads the client IP only after that check and fails open on null, checks Origin against the trusted forwarded host, and no secrets appear in logs or health responses.
- [global/git-workflow](../../../../../../standards/global/git-workflow.md): branch off `develop`, PR to `develop`, `feat(accounts-auth): …` commits.

## Changelog

| Date | Author | Type | Change | Ref |
|---|---|---|---|---|
| 2026-10-13 | david-schwartzman | created | Initial shaping | — |
| 2026-10-13 | david-schwartzman | change | Aligned with the PR #21 review fixes and PR #20's latest commits: the web proxy does the `/api` rewrite with the trusted proxy headers (AC4, AC14), new proxy-secret middleware (AC13), Origin check against the trusted forwarded host instead of `WEB_ORIGIN` (AC8), `getClientIp(req)` reads `x-stride-client-ip` only after the secret check (AC9), `WEB_PROXY_SECRET` replaces `WEB_ORIGIN` (AC10), preview pairing as a goal with a documented fallback and the protection-bypass header (AC12), exit checks (AC15); AC6 allows `actions.test.ts`; #20's `request-ip.ts` stays in the web; Covers adds the web proxy and client modules and `apps/web/.env.example` — the architecture changed under the shaped spec (client-IP trust model, Origin target, preview pairing) | https://github.com/david-schwartzman/Stride/pull/21 |
| 2026-10-15 | david-schwartzman | change | AC8: the Origin check rejects with 401 instead of 403, so both gatekeeper checks (proxy secret, Origin) answer 401; `standards.md` matches; new task T37 switches the middleware and its tests (done T15/T30 still read 403 as history) — tech lead decision: both checks run before the user is identified | — |
| 2026-10-15 | david-schwartzman | change | AC14: `apiFetch` drops caller `x-stride-*` headers, passes the incoming `Origin` through instead of deriving one from the host, defaults to a 10-second timeout, and sends the Preview bypass header; AC12: the bypass comes from one helper shared by the proxy and `apiFetch`; AC11: migrate runs right after install, before the unit tests (as CI does); Covers: `playwright.config.ts` → `apps/web/playwright.config.ts`, adds the files the build actually created (`packages/shared/src/health.ts`, the `tsconfig.build.json`s, the API's ESLint and Vitest configs, the web config and health tests, `apps/web/e2e/api-health.spec.ts`, `apps/api/src/app.module.test.ts`) and `apps/web/vercel.json`; T35 notes the hardening — code and security review of the branch | — |
| 2026-10-15 | david-schwartzman | change | AC14 lists `apiFetch`'s existing path check (a single leading `/`); Covers adds `packages/shared/src/health.test.ts`; T23: both Vercel build commands build `@stride/shared` first — re-review of the branch | — |
| 2026-10-15 | david-schwartzman | change | auth-api-migration moved the proxy-secret check into `apps/api/src/setup-app.ts` (first Express middleware, before body parsing) and removed the temporary Prisma-in-web exception; "moved by auth-api-migration" notes added to the temporary boundary exception, AC6, AC10, Prisma and Common, original text kept as history — auth-api-migration review | — |
