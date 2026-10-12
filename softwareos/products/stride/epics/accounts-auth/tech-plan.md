# Accounts & Auth — Tech Plan

> Epic: epic.md · Product: ../../mission.md

## Approach

An in-house session module in `src/lib/auth/` (no auth library), following the Stride Auth & Session Security Plan (OWASP / The Copenhagen Book pattern). Login creates a random 256-bit opaque token, sets it in an HttpOnly `__Host-stride_session` cookie, and stores only its SHA-256 hash in a `Session` row (30-day sliding expiry, 90-day absolute cap). Logout deletes the row, so revocation is instant. Passwords are hashed with Argon2id + per-user salt + server-side pepper (`@node-rs/argon2`), 12–128 characters. Failed logins are throttled per account and per IP in Postgres (`AuthAttempt`). /signup and /login are server-rendered pages with small client forms that call Server Actions, validated with the same Zod schemas on client and server. The proxy (Next.js middleware) checks only that the session cookie exists and redirects signed-out visitors from /checkout, /account, /wishlist to /login?callbackUrl=<path>; after login we redirect back to callbackUrl (same-origin paths only). `getCurrentSession()` (cached per request) and `requireUser()` are the real checks, used by pages, the header and every Server Action.

## Architecture Impact

This is the first epic, so it creates the base:

- New Next.js App Router project (TypeScript strict, Tailwind, ESLint/Prettier, Vitest, Playwright, GitHub Actions CI).
- Prisma + Neon setup (`directUrl` for migrations) and a shared Prisma client module.
- Shared layout/header.

Auth itself:

- New models + the first migration: `User` (email unique, name, password hash, `pepperVersion`), `Session` (id = token hash, userId, createdAt, expiresAt, lastSeenAt, userAgent, ipAddress), `AuthAttempt` (key, createdAt).
- `src/lib/auth/` (password, session, cookie, current-session, throttle), /login and /signup routes, a proxy for protected routes.
- New packages: `@node-rs/argon2`, `@oslojs/crypto`, `@oslojs/encoding` (exact-pinned).
- New env vars `PASSWORD_PEPPER` and `GUEST_CART_SECRET` (Vercel + local, different value per environment). No `AUTH_SECRET`.
- Header gets a session-aware account/login state.
- No new external services.

## Risks & Unknowns

- Resolved: Auth.js Credentials + JWT vs database sessions — Auth.js is dropped; database sessions give instant revocation (2026-10-11).
- Resolved: Auth.js v5 API churn — no auth library.
- Resolved: login brute force — per-account and per-IP throttling in Postgres is in v1.
- We now own about 150 lines of security-critical code: it needs full unit tests (expiry, sliding renewal, 90-day cap, revoke, throttle windows) before the forms are built.
- Pepper loss or leak: losing `PASSWORD_PEPPER` loses every password. Back it up in a password manager; rotate via `User.pepperVersion` and re-hash on login.
- `@node-rs/argon2` is a prebuilt native module: confirm it loads on a Vercel preview (serverless function) early.
- One indexed session lookup per authenticated request: watch latency on Neon cold starts; use the pooled connection string.
- `__Host-` cookies need `Secure`; Safari may reject them on `http://localhost`, so dev uses the plain `stride_session` name.
- Return-to redirect must only allow internal paths (open-redirect risk).
- Spike: a quick Prisma + Neon + Vercel preview smoke test in `app-foundation`, then a short proof that Argon2id hashing and the session cookie work on a Vercel preview before building forms.

## Candidate Specs

- `app-foundation` — app scaffold, CI, Prisma + Neon setup with shared client, shared layout/header
- `signup-login` — User/Session/AuthAttempt models, `src/lib/auth/` (Argon2id + pepper, DB sessions, throttling), sign-up/login/logout with inline errors
- `protected-routes` — cookie-presence proxy for /checkout, /account, /wishlist with safe return-to redirect, `requireUser()`, plus header session state
- `security-headers` — HSTS, a static CSP with `'unsafe-inline'` in script-src (no nonces: a nonce CSP forces every page to render dynamically, which would undo protected-routes' static/PPR shell for catalog pages; no hashes: they can't cover the App Router's per-page inline RSC scripts — see the security-headers spec), nosniff, Referrer-Policy, Permissions-Policy, `Cache-Control: private, no-store` on private pages (required for launch)
- `session-management` — change password (current password required, revoke all sessions, new session), "Your devices" page with per-device sign-out and "sign out of all other devices", 10-session cap, nightly Vercel Cron cleanup of expired sessions and old auth attempts
- `auth-event-logging` — log signup, login success/failure, logout, revoke and password change with user ID, IP, user agent and time; never passwords, tokens or cookies
