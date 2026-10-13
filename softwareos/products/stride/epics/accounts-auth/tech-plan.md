# Accounts & Auth — Tech Plan

> Epic: epic.md · Product: ../../mission.md

## Approach

An in-house auth module in the NestJS API, `apps/api/src/auth/` (no auth library), following the Stride Auth & Session Security Plan (OWASP / The Copenhagen Book pattern). Login creates a random 256-bit opaque token, sets it in an HttpOnly `__Host-stride_session` cookie, and stores only its SHA-256 hash in a `Session` row (30-day sliding expiry, 90-day absolute cap). Logout deletes the row, so revocation is instant. Passwords are hashed with Argon2id + per-user salt + server-side pepper (`@node-rs/argon2`), 12–128 characters. Failed logins are throttled per account and per IP in Postgres (`AuthAttempt`). /signup and /login are server-rendered pages in `apps/web` with small client forms that POST to `/api/auth/*` (same-origin rewrite to the API, which sets the cookie), validated with the same Zod schemas (`packages/shared`) on client and server. The proxy (Next.js middleware) checks only that the session cookie exists and redirects signed-out visitors from /checkout, /account, /wishlist to /login?callbackUrl=<path>; after login we redirect back to callbackUrl (same-origin paths only). The API's `AuthGuard` is the real check on every endpoint that needs a user. On the web, `getCurrentSession()` (cached per request, calls `GET /auth/me` with the cookie forwarded) and `requireUser()` decide what pages and the header render. (Backend moved to a separate NestJS service on 2026-10-13 — see `../../architecture.md`.)

## Architecture Impact

This is the first epic, so it creates the base:

- New Next.js App Router project (TypeScript strict, Tailwind, ESLint/Prettier, Vitest, Playwright, GitHub Actions CI).
- Prisma + Neon setup (`directUrl` for migrations) and a shared Prisma client module.
- From 2026-10-13: an npm-workspaces monorepo — `apps/web` (the Next app), `apps/api` (NestJS, owns Prisma + migrations), `packages/shared` (Zod schemas, types). A second Vercel project for the API, Neon attached to it, `/api/*` rewrite in the web app, server-only `API_URL` on the web.
- Shared layout/header.

Auth itself:

- New models + the first migration: `User` (email unique, name, password hash, `pepperVersion`), `Session` (id = token hash, userId, createdAt, expiresAt, lastSeenAt, userAgent, ipAddress), `AuthAttempt` (key, createdAt).
- API auth module `apps/api/src/auth/` (password, session, cookie, throttle, `AuthGuard`, `GET /auth/me`), /login and /signup routes in the web app, a web proxy for protected routes. (The first build put this in `src/lib/auth/` inside the Next app; `auth-api-migration` moved it into the API.)
- New packages: `@node-rs/argon2`, `@oslojs/crypto`, `@oslojs/encoding` (exact-pinned).
- New env vars `PASSWORD_PEPPER` and `GUEST_CART_SECRET` (API Vercel project + local, different value per environment); `API_URL` on the web project. No `AUTH_SECRET`.
- Header gets a session-aware account/login state.
- No new external services.

## Risks & Unknowns

- Resolved: Auth.js Credentials + JWT vs database sessions — Auth.js is dropped; database sessions give instant revocation (2026-10-11).
- Resolved: Auth.js v5 API churn — no auth library.
- Resolved: login brute force — per-account and per-IP throttling in Postgres is in v1.
- We now own about 150 lines of security-critical code: it needs full unit tests (expiry, sliding renewal, 90-day cap, revoke, throttle windows) before the forms are built.
- Pepper loss or leak: losing `PASSWORD_PEPPER` loses every password. Back it up in a password manager; rotate via `User.pepperVersion` and re-hash on login.
- `@node-rs/argon2` is a prebuilt native module: confirmed on a Vercel preview of the Next app; re-confirm on the API project's preview once NestJS is deployed.
- One indexed session lookup per authenticated request: watch latency on Neon cold starts; use the pooled connection string.
- `__Host-` cookies need `Secure`; Safari may reject them on `http://localhost`, so dev uses the plain `stride_session` name.
- Return-to redirect must only allow internal paths (open-redirect risk).
- Spike: a quick Prisma + Neon + Vercel preview smoke test in `app-foundation`, then a short proof that Argon2id hashing and the session cookie work on a Vercel preview before building forms.
- New (2026-10-13): preview pairing. Each web preview should call the API preview from the same commit, with its own Neon branch, but `API_URL` is one static Preview env value. API previews also sit behind Vercel Deployment Protection, so web previews need to send `x-vercel-protection-bypass`, which a plain `next.config` rewrite can't add (one reason the web proxy does the rewrite). Spike both in `api-foundation`; evaluate deriving the API branch URL from `VERCEL_GIT_COMMIT_REF` and Vercel Services (both apps in one project). Until then pairing is a goal, and a web preview may call the shared `develop` API preview.
- New: client IP crosses the `/api` rewrite, and the API is publicly reachable (Server Components call `API_URL`). Any forwarded header would be spoofable by direct callers, and the connecting address is the web's egress IP, shared by all shoppers. Without a trust model, #20's per-IP throttles (30 logins / 15 min, 10 sign-ups / 60 min) are either bypassed or lock the whole site. Decision (2026-10-13, PR #21 review): the web sets `x-stride-proxy-secret` (`WEB_PROXY_SECRET`), `x-stride-client-ip` and `x-stride-forwarded-host` on every call; the API rejects calls without a valid secret and reads the IP only after that check (validated, else null); per-IP throttles fail open on null. See `architecture.md`, Trusted proxy headers.
- New: every Server Component read is now an extra network hop to the API (plus an API cold start). Watch page latency; cache public catalog reads.
- New: security headers (security-headers spec, set via `next.config.ts` `headers()`) must also reach `/api/*` responses that come back through the rewrite. Verify on the `api-foundation` preview; if they don't, set the same headers in Nest.
- New: the Origin check needs a target. Behind the rewrite, Nest sees its own `Host`, so "Origin == Host" would 403 every POST. The API compares `Origin` with `https://` + the secret-verified `x-stride-forwarded-host` (`http://` in local dev only), which also works on previews, and rejects a missing `Origin`.
- New: the two projects don't deploy atomically. The API ships first and stays backward-compatible with the web deploy in production (`standards/global/tech-stack.md`, Deploy order).
- New: the session cookie must be set through the same-origin rewrite. If the API is ever called on its own domain from the browser, `__Host-` breaks and CORS is needed — don't.

## Candidate Specs

- `app-foundation` — app scaffold, CI, Prisma + Neon setup with shared client, shared layout/header
- `signup-login` — User/Session/AuthAttempt models, `src/lib/auth/` (Argon2id + pepper, DB sessions, throttling), sign-up/login/logout with inline errors
- `protected-routes` — cookie-presence proxy for /checkout, /account, /wishlist with safe return-to redirect, `requireUser()`, plus header session state
- `security-headers` — HSTS, a static CSP with `'unsafe-inline'` in script-src (no nonces: a nonce CSP forces every page to render dynamically, which would undo protected-routes' static/PPR shell for catalog pages; no hashes: they can't cover the App Router's per-page inline RSC scripts — see the security-headers spec), nosniff, Referrer-Policy, Permissions-Policy, `Cache-Control: private, no-store` on private pages (required for launch)
- `session-management` — change password (current password required, revoke all sessions, new session), "Your devices" page with per-device sign-out and "sign out of all other devices", 10-session cap, nightly Vercel Cron cleanup of expired sessions and old auth attempts
- `auth-event-logging` — log signup, login success/failure, logout, revoke and password change with user ID, IP, user agent and time; never passwords, tokens or cookies
- `api-foundation` (shaped 2026-10-13, [spec](specs/2026-10-13-api-foundation/spec.md)) — npm-workspaces monorepo (`apps/web`, `apps/api` NestJS scaffold, `packages/shared`); move Prisma, migrations and the client into `apps/api`; second Vercel project + Neon integration; the web proxy's `/api` rewrite (strips `/api`, forwards the whole `Cookie` header, sets the trusted proxy headers) and `API_URL`; the API's global proxy-secret middleware, `getClientIp(req)` (`apps/api/src/common/request-ip.ts`) and the Origin guard; `WEB_PROXY_SECRET` on both projects; CI and Playwright run both apps; spike preview pairing and the Deployment Protection bypass; update every spec's Covers paths. Exit criteria: on a preview, a direct call to the API without the secret gets 401, a spoofed `x-stride-client-ip` from the browser is overwritten, two shoppers on different IPs land in different throttle buckets, and a null IP fails open (never one shared bucket); security headers reach `/api/*` responses
- `auth-api-migration` (shaped 2026-10-13, [spec](specs/2026-10-13-auth-api-migration/spec.md)) — move `src/lib/auth/*` into a Nest auth module with `POST /auth/signup|login|logout`, `GET /auth/me` and the `AuthGuard` (it owns both, with tests for a valid, missing, expired, revoked and tampered cookie and no user data in the 401 body; protected-routes builds on them); the ported throttles read the IP from `getClientIp(req)` and keep #20's `ipThrottleBucket` (IPv6 per /64); web forms POST to `/api`; delete `src/features/auth/actions.ts`; port the tests; then `/spec-changes` on signup-login and app-foundation
