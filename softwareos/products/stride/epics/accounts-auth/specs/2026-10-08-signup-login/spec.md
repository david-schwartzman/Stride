# Sign-up & Login

> Epic: ../../epic.md
> Status: shaped
> Branch: feat/accounts-auth/signup-login
> Covers: /login, /signup, src/app/(auth)/**, src/lib/auth/**, src/features/auth/**, prisma/migrations/*_init_auth/**

## Overview

Second spec of Accounts & Auth. Builds on `app-foundation` (scaffold, Prisma/Neon, `Input`/`Button`, layout) and delivers the identity every later epic needs: `User`, `Session` and `AuthAttempt` models, an in-house auth module in `src/lib/auth/` with **opaque database sessions** (no auth library, no JWT), Argon2id + pepper password hashing, login throttling, `/signup` and `/login` pages with inline errors, and a `signOutAction`.

Serves these epic success criteria:
- Sign-up creates a user with an Argon2id-hashed password (salted and peppered); plain passwords are never stored or logged.
- Login sets an httpOnly session cookie.
- Wrong-password and existing-email errors show inline and match the design (`stride-design/pages/Login.dc.html`, `Signup.dc.html`).
- Zod validates both forms on client and server.

It also defines the **post-sign-in hook** `onSignedIn(userId)` that cart-checkout's `guest-cart-merge` plugs into (it ships as a no-op). This closes the open question in cart-checkout's tech plan.

Handed to `protected-routes`: the proxy for /checkout, /account, /wishlist; `callbackUrl` return-to; `requireUser()`; the header's session state + logout button; the full "reach a protected page" Playwright journey. Until then, login/signup redirect to `/`.

## Goals & User Stories

- As a new shopper, I can create an account with name, email and password so I can check out and save favorites.
- As a returning shopper, I can log in with email and password and stay logged in across pages.
- As a shopper, I see an inline error telling me how to fix it: wrong password, email already registered, invalid email, password too short, too many attempts.
- As a logged-in shopper, I can log out, and a copy of my session cookie stops working (the action exists; the header button arrives in protected-routes).
- As a developer on cart-checkout, I have one documented place to run code right after a shopper signs in.

## Acceptance Criteria

1. AC1: `/signup` renders the Signup design: "Create an account" heading, Name / Email / Password fields with visible labels, Password hint "At least 12 characters.", "Create account" button, and a link "Already have an account? Log in" → `/login`. It works at 375px.
2. AC2: `/login` renders the Login design: Email / Password fields, a "Log in" button, and a link "New to Stride? Create an account" → `/signup`. It works at 375px.
3. AC3: Submitting a valid sign-up creates exactly one `User` (email trimmed + lowercased, unique), stores only an Argon2id hash made with the server-side pepper (never the plain password), signs the shopper in and redirects to `/`.
4. AC4: Signing up with an email that already exists (any case) creates no user and shows "An account with this email already exists. Log in instead." inline on the Email field. "Log in" links to `/login`.
5. AC5: Logging in with a wrong password, or an email with no account, shows "That password isn't right. Try again." inline on the Password field and sets no session cookie.
6. AC6: A successful login sets the session cookie — `__Host-stride_session` in production (HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 30 days, no Domain), plain `stride_session` without Secure in development — and redirects to `/`. The session survives navigation and reload, and `getCurrentSession()` returns the session with its user `{ id, email, name }` server-side.
7. AC7: The same Zod schemas validate on client (on blur, per the Input README) and server. Name is required, email must be valid, and password needs 12–128 characters. Server-side failures come back as per-field errors, and a request that bypasses client validation still gets them.
8. AC8: Field errors use the `Input` `error` prop (`aria-invalid` + `aria-describedby`). The submit button shows a pending state and blocks double submit.
9. AC9: The `signOutAction` Server Action (POST) deletes the current `Session` row, clears the cookie (same name and attributes, `Max-Age=0`) and redirects to `/`. A logged-in user who opens `/login` or `/signup` is redirected to `/`.
10. AC10: After every successful sign-in (login or sign-up), `onSignedIn(userId)` from `src/features/auth/hooks.ts` is called exactly once. It is a no-op today. If it throws, the error is logged (without the password) and sign-in still succeeds and redirects.
11. AC11: Passwords and session tokens never appear in logs, error messages, returned form state, or the database (the `Session` row holds only the token hash). A Playwright test (sign up → log out → log in → the session holds) passes in CI against a real Postgres.
12. AC12: Every login and sign-up creates a **new** random 256-bit token; the database stores only `sha256(token)` as the `Session` id, plus userId, expiresAt, userAgent and IP. A token that arrived with the request is never reused.
13. AC13: Sessions expire 30 days after last renewal: a lookup with fewer than 15 days left pushes `expiresAt` to now + 30 days, never beyond `createdAt` + 90 days. An expired session is treated as logged out and its row deleted.
14. AC14: After 5 failed logins for one email within 15 minutes, further attempts for that email are refused with "Too many attempts, try again in N minutes." for an increasing delay (1, 2, 4, 8, up to 15 minutes); 30 failures from one IP within 15 minutes block that IP for 15 minutes; sign-up is limited to about 10 per hour per IP. A successful login clears the email's counter. This is throttling, never a permanent lockout.
15. AC15: Logging in with an email that has no account still runs a password verify against a dummy hash, so the response time doesn't reveal whether the account exists.
16. AC16: After logout, a copy of the old session cookie is rejected (treated as logged out) on any device.

## Technical Approach

- **Data:** add to `prisma/schema.prisma` (handed off by app-foundation):
  - `model User { id String @id @default(cuid()); email String @unique; name String; passwordHash String; pepperVersion Int @default(1); createdAt DateTime @default(now()); updatedAt DateTime @updatedAt; sessions Session[] }`
  - `model Session { id String @id /* sha256(token) hex */; userId String; user User @relation(fields: [userId], references: [id], onDelete: Cascade); createdAt DateTime @default(now()); expiresAt DateTime; lastSeenAt DateTime @default(now()); userAgent String?; ipAddress String?; @@index([userId]); @@index([expiresAt]) }`
  - `model AuthAttempt { id String @id @default(cuid()); key String /* "email:<e>" | "ip:<ip>" | "signup-ip:<ip>" */; createdAt DateTime @default(now()); @@index([key, createdAt]) }`
  - Migration `prisma/migrations/<ts>_init_auth/` via `prisma migrate dev --name init_auth`. It only adds tables, so it is backward-compatible.
- **Passwords:** `src/lib/auth/password.ts` exports `hashPassword` / `verifyPassword` using exact-pinned `@node-rs/argon2` with `{ memoryCost: 19456, timeCost: 2, parallelism: 1, secret: Buffer.from(process.env.PASSWORD_PEPPER, "base64") }`. It also exports `verifyDummy()` for the unknown-email path. It is the only module that touches Argon2 or the pepper. `PASSWORD_PEPPER` comes from env (already in `.env.example`).
- **Sessions:** `src/lib/auth/session.ts` (exact-pinned `@oslojs/crypto`, `@oslojs/encoding`): `generateSessionToken()` (32 random bytes, base32), `hashToken`, `createSession(token, userId, { ua, ip })`, `validateSessionToken(token)` (expiry, sliding renewal under 15 days, 90-day cap, delete when expired), `invalidateSession(token)`, `invalidateAllSessions(userId)`.
- **Cookie + current session:** `src/lib/auth/cookie.ts` sets and deletes the cookie with the exact attributes (name `__Host-stride_session` when `NODE_ENV === "production"`, else `stride_session`). `src/lib/auth/current.ts` exports `getCurrentSession = cache(async () => …)`, which reads the cookie and validates it once per request. Server Components can't set or delete cookies, so cookie writes happen only in Server Actions (and the protected-routes proxy).
- **Throttling:** `src/lib/auth/throttle.ts` counts `AuthAttempt` rows in Postgres (not memory: serverless instances don't share it): `checkLoginThrottle(email, ip)`, `recordLoginFailure(email, ip)`, `clearLoginFailures(email)`, `checkSignupThrottle(ip)`. Limits per AC14. The client IP comes from the `x-forwarded-for` header Vercel sets.
- **Schemas:** `src/features/auth/schemas.ts` defines `signupSchema` (name, email, password) and `loginSchema` (email, password). Email is trimmed and lowercased. Password is 12–128 characters, any characters, no composition rules (the 128 cap keeps huge inputs off the hasher). The forms and the actions both import these.
- **Server Actions** (`src/features/auth/actions.ts`, `"use server"`):
  - `signupAction(prev, formData)`: `checkSignupThrottle`, `safeParse`, `hashPassword`, create the user (catch Prisma `P2002` → email field error, so a race can't create a duplicate), then `generateSessionToken` + `createSession` + set cookie, then `runOnSignedIn(user.id)`, then `redirect("/")`. The existing-email message (AC4) is kept on purpose: v1 has no email provider, so a neutral "check your email" flow isn't possible; signup is rate-limited instead.
  - `loginAction`: `checkLoginThrottle` (→ "Too many attempts…" error), `safeParse`, look up the user by normalized email; if missing, `verifyDummy()` and return the AC5 error; else `verifyPassword` and on failure `recordLoginFailure` + AC5 error. On success: `clearLoginFailures`, new token, `createSession`, set cookie, `runOnSignedIn(user.id)`, `redirect("/")`.
  - `runOnSignedIn` wraps `onSignedIn` in try/catch. On error it does `console.error` with the userId and error only, and sign-in still succeeds.
  - `signOutAction`: `invalidateSession(token)`, delete the cookie, `redirect("/")`.
  - Return shape `{ fieldErrors?: Record<field, string>, values?: { name?, email? } }`. The password is never echoed back.
- **Hook:** `src/features/auth/hooks.ts` exports `async function onSignedIn(userId: string): Promise<void> {}` with a doc comment pointing at guest-cart-merge.
- **UI:** `src/app/(auth)/layout.tsx` (split panel per the design: "Welcome back" / "Join Stride" copy at left, hidden on mobile); `src/app/(auth)/login/page.tsx` and `signup/page.tsx` are Server Components that call `getCurrentSession()` and redirect to `/` if already signed in. Client forms `src/features/auth/LoginForm.tsx` and `SignupForm.tsx` use `useActionState` + `useFormStatus`, client Zod validation on blur, and app-foundation's `Input`/`Button`, with `autoComplete` set to `name` / `email` / `current-password` / `new-password`. The design's "At least 8 characters." hint is replaced by "At least 12 characters." (flagged to design).
- **CI:** extend app-foundation's `ci.yml` with a `postgres:16` service container, set `DATABASE_URL`/`DIRECT_URL` and a test-only `PASSWORD_PEPPER` env, and run `prisma migrate deploy` before e2e. This uses a service container instead of the Neon branch app-foundation anticipated (recorded in references.md). The e2e test uses a unique email per run and logs out by calling the logout action (clearing the cookie); `signOutAction` is also covered by a unit test.
- **Build order and spike:** the auth module (`password.ts`, `session.ts`, `cookie.ts`, `current.ts`, `throttle.ts`) is built and unit-tested before the actions and forms that call it. Before the forms, a throwaway route proves on a Vercel preview that `@node-rs/argon2` (a prebuilt native module) loads in the serverless function and that the session cookie round-trips, per the tech plan's spike; the route is removed afterwards.

## Out of Scope

- Proxy/middleware, `callbackUrl` return-to, `requireUser()`, protected pages (protected-routes).
- Header logged-in state and logout button (protected-routes). The Login page's "Log in to check out… cart is saved" banner is shown only when arriving from /checkout, so it ships with protected-routes.
- Guest-cart merge logic (cart-checkout / guest-cart-merge). Only the no-op hook ships here.
- Password reset, social login, email verification, emails, profile page (epic Out of Scope; no email provider in v1).
- Change password, "Your devices" list, sign out of other devices, the 10-session cap and the nightly cleanup cron (candidate `session-management`).
- Security headers and CSP (candidate `security-headers`); auth event logging (candidate `auth-event-logging`).
- Breached-password (Have I Been Pwned) check — optional, later.
- Pepper rotation tooling: `pepperVersion` is stored now, the re-hash-on-login flow comes when a rotation is needed.

## Standards Applied

- [global/tech-stack](../../../../../../standards/global/tech-stack.md): in-house session module, Argon2id + pepper, opaque DB sessions in an HttpOnly cookie, Server Actions for auth, Zod on client and server, expand→contract migrations.
- [global/auth-security](../../../../../../standards/global/auth-security.md): new token per login, token hash only, POST-only logout, only `src/lib/auth/` touches tokens and hashes, no secrets in logs.
- [global/git-workflow](../../../../../../standards/global/git-workflow.md): branch off `develop`, PR to `develop`, commit format.

## Changelog

| Date | Author | Type | Change | Ref |
|---|---|---|---|---|
| 2026-10-08 | david-schwartzman | created | Initial shaping | — |
| 2026-10-11 | david-schwartzman | change | Auth.js/JWT/bcrypt replaced by in-house `src/lib/auth/` (opaque DB sessions, Argon2id + pepper, Postgres throttling); password 8–72 → 12–128; AC1, AC3, AC6, AC7, AC9, AC11 edited, AC12–AC16 added; Technical Approach, Out of Scope, Covers updated — adopt Stride Auth & Session Security Plan: Auth.js Credentials is JWT-only (no revocation); move to own DB-session module + Argon2id | https://claude.ai/artifact/QL1DDEEN6QERM6GsZP4a8h |
| 2026-10-11 | david-schwartzman | change | Technical Approach: build order (auth module before actions/forms) + Vercel preview spike for @node-rs/argon2 and the session cookie; tasks.md: "Auth module" group (T15–T17) moved ahead of actions/forms (IDs unchanged), T18 spike added — T7/T8 called createSession/throttle before T15–T17 built them, and the tech plan's Argon2-on-Vercel spike had no task (project audit M2, M3) | — |
