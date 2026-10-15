# Auth API Migration

> Epic: ../../epic.md
> Status: in-progress
> Branch: feat/accounts-auth/auth-api-migration
> Covers: apps/api/src/auth/**, packages/shared/src/auth/**, apps/web/src/features/auth/**, apps/web/src/lib/auth/**, apps/web/src/lib/db.ts, apps/web/src/instrumentation.ts, apps/api/src/setup-app.ts, apps/api/src/common/body-parsing.ts

## Overview

Moves signup-login's auth code out of the Next app into a NestJS `AuthModule`, so login, sign-up and logout go through the API and `apps/web` stops touching the database. This removes api-foundation's temporary Prisma-in-web exception (its AC6) and delivers the `AuthGuard` + `GET /auth/me` contract that protected-routes, session-management, auth-event-logging and cart-checkout's guest-cart merge build on. It's a behaviour-preserving move: the pages, messages, cookie, hashes and throttles stay exactly as signup-login shipped them; only where the code runs changes. Serves the epic brief's "Argon2id-hashed, peppered passwords, never stored or logged" and "login sets an httpOnly session cookie". Afterwards, `/spec-changes` on signup-login and app-foundation hands over the moved paths.

## Goals & User Stories

- As a shopper, I sign up, log in and log out exactly as before. Nothing visible changes.
- As a developer, every database and secret access lives in `apps/api`, so the web/API boundary in `tech-stack.md` holds without exceptions.
- As a later spec (protected-routes, session-management, auth-event-logging, guest-cart-merge), I can protect an endpoint with `AuthGuard`, read the user with `@CurrentUser()`, and hook into the API's auth flow.

## Acceptance Criteria

1. AC1: `apps/api/src/auth/` (`AuthModule`) exposes `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout` and `GET /auth/me`. The browser reaches them only as `/api/auth/*` through the web proxy, behind api-foundation's proxy-secret and Origin middleware.
2. AC2: Sign-up with a valid body creates one `User` with a normalised email and an Argon2id + pepper hash, starts a new session (ending the session of any incoming cookie), sets the cookie, calls `onSignedIn(userId)` once (a failure is logged, not blocking) and answers 200 `{ redirectTo: "/" }`. An invalid body → 400 `{ fieldErrors }` with the shared schema's messages; a taken email → 409 with `fieldErrors.email = MESSAGES.emailTaken` and no user created; the per-IP sign-up limit → 429 `{ formError }`. As today, the sign-up limit is checked before validation, so a throttled request gets 429 even with an invalid body.
3. AC3: Login with the right password issues a new 256-bit token (never reuses the incoming one; ends the session of any incoming cookie), stores only its sha256, sets the cookie, clears the account's failures, calls `onSignedIn` and answers 200 `{ redirectTo: "/" }`. A wrong password or unknown email → 401 with the same `fieldErrors.password = MESSAGES.wrongPassword` (as today), the same timing (dummy hash) and no cookie. An invalid body → 400 `{ fieldErrors }`. Throttled → 429 `{ formError }` with the existing back-off message.
4. AC4: Throttles keep signup-login AC14's limits and windows. The IP comes only from api-foundation's `getClientIp(req)` (`x-stride-client-ip`). `ipThrottleBucket` is ported (IPv4 exact, IPv6 per /64, IPv4-mapped as IPv4). A null IP skips the per-IP limits (fail open) and never shares one bucket.
5. AC5: The cookie keeps signup-login AC6's name and attributes: `__Host-stride_session` in production, `stride_session` otherwise; HttpOnly, Secure in production, SameSite=Lax, Path=/, no Domain, Max-Age 30 days. Only `apps/api/src/auth/` sets or clears it, and it reaches the browser as the API's `Set-Cookie` through the `/api` rewrite. The API picks the name from its own `NODE_ENV`. Production runs it with `NODE_ENV=production`. The local e2e run doesn't, because api-foundation's Origin check accepts `http://localhost` only outside production, so e2e sees `stride_session`. The production name and Secure flag are covered by the controller unit tests. Because the API's `NODE_ENV` picks the name, the web side must never derive it from its own `NODE_ENV`: `next start` always runs with `NODE_ENV=production`, while the e2e API runs with `NODE_ENV=test`, so the two would disagree. `packages/shared/src/session-cookie.ts` (created by protected-routes) is the single source of the name rule; the web uses the cookie the API actually set (see the protected-routes handoff below).
6. AC6: `POST /auth/logout` deletes the session of the incoming cookie (if any), clears the cookie and answers 303 to `/`. It works as a plain HTML form POST without JavaScript, and the old token is rejected afterwards. There is no GET logout.
7. AC7: `GET /auth/me` runs the `AuthGuard`: a valid cookie → 200 `{ id, email, name }` and nothing else; a missing, expired, revoked or tampered cookie → 401 whose body holds no user data. Sliding renewal and the 90-day cap match signup-login AC13; when the guard renews a session on a browser request it re-sets the cookie's Max-Age (a Server Component's server-to-server call can't pass it on, as today; protected-routes' `refreshSessionCookie` covers that). `@CurrentUser()` gives handlers the same `{ id, email, name }`.
8. AC8: `signupSchema`, `loginSchema`, `normalizeEmail`, `MESSAGES` and the auth request/response schemas live in `packages/shared/src/auth/`. The web forms and the API both validate with them, so field limits and messages have one source.
9. AC9: `/login` and `/signup` look and behave as before (signup-login AC1, AC2, AC4, AC5, AC7 and AC8 still hold): client validation on blur and submit, a pending state, no double submit, inline field and form errors from the API's response, and name/email kept after an error. The forms send JSON with `fetch` to `/api/auth/signup|login`. On success they navigate to `redirectTo`. `apps/web/src/features/auth/` has no Server Actions.
10. AC10: A signed-in shopper who opens `/login` or `/signup` is redirected to `/` (signup-login AC9). `RedirectIfSignedIn` checks through `apiFetch("/auth/me")`.
11. AC11: `apps/web` has no Prisma, `@node-rs/argon2`, `@oslojs/*`, password or session code. `src/lib/db.ts`, `src/lib/auth/**` and `src/features/auth/actions.ts` are deleted, and those packages are removed from `apps/web/package.json`. The ESLint override is gone, so an `@prisma/client` or `@/lib/db` import anywhere in `apps/web` is a lint error. `apps/web/.env.example` no longer lists `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER` or `TEST_DATABASE_URL`.
12. AC12: The API refuses to start without a valid `PASSWORD_PEPPER` (base64, ≥ 32 bytes), and the error never contains the value. `apps/web/src/instrumentation.ts` no longer checks it.
13. AC13: No password, token, cookie or raw request body appears in API logs or `/auth/*` responses (signup-login AC11). Users see generic messages.
14. AC14: The auth unit tests (password, session, throttle, IP bucket, fake DB) and the Postgres `*.db.test.ts` run in `apps/api`. New controller and guard tests cover AC2–AC7. The form tests mock `fetch`. `e2e/auth.spec.ts` passes against both apps and asserts the non-production cookie name and flags (`stride_session`, HttpOnly, SameSite=Lax, Path=/, no Domain); the unit tests assert the production ones.
15. AC15: No regression. Existing users still log in (same Argon2 parameters, pepper, tables; no migration). From the root, lint, typecheck, test and test:e2e pass.

## Technical Approach

**API (`apps/api/src/auth/`)**, ported from `apps/web/src/lib/auth/` with the logic unchanged:
- `password.service.ts`: `getPepper`, `hashPassword`, `verifyPassword`, `DUMMY_HASH`/`verifyDummy`; Argon2id m=19456, t=2, p=1. `AuthModule.onModuleInit` calls `getPepper()` so a bad pepper fails boot (AC12).
- `session.service.ts`: `generateSessionToken`, `hashToken`, `createSession`, `validateSessionToken` (sliding renewal, `updateMany` race handling), `invalidateSession`, `invalidateAllSessions`, all through `PrismaService`.
- `throttle.service.ts` + `ip-bucket.ts`: the login/sign-up throttles and `ipThrottleBucket`. The IP comes from `getClientIp(req)` (`common/request-ip.ts`, unchanged).
- `session-cookie.ts`: the name rule and attributes, set and cleared with Express `res.cookie`/`res.clearCookie`, read through `cookie-parser` (new, exact-pinned; registered in `setup-app.ts`).
- `auth.controller.ts`: the four routes. Bodies are validated by a `ZodBodyPipe` (in `auth/`) with the shared schemas. Errors are the shared `authErrorSchema` bodies (400/401/409/429). Logout uses `@Redirect`-style 303.
- `auth.guard.ts` + `current-user.decorator.ts`: read the cookie, `validateSessionToken`, attach `{ id, email, name }`, re-set the cookie when renewed, 401 otherwise.
- `on-signed-in.ts`: the `onSignedIn` stub and `runOnSignedIn` wrapper (swallow + log), moved from the web. guest-cart-merge fills it later.
- `AuthModule` imported in `AppModule`.
- Request order (`apps/api/src/setup-app.ts`, called by `main.ts`; the app is created with `bodyParser: false`): the proxy-secret check is the first Express middleware, before body parsing, so a request without the secret gets 401 with an empty body even when its body is malformed. Body parsing comes next, then `cookie-parser`. `AppModule` keeps only the Origin check (a Nest middleware, after these), so the secret check runs once. `auth.wiring.test.ts` boots the real `AppModule` to prove the order.
- Body parsing is global, in `apps/api/src/common/body-parsing.ts`: the JSON and urlencoded parsers plus an error handler that answers a malformed body with a 400 that never echoes or logs it. `/auth/login` and `/auth/signup` answer like an empty form (`auth/malformed-body.ts`); other routes get a generic 400.
- Guarded responses are never cached: `AuthGuard` (its 401s included) and `GET /auth/me` send `Cache-Control: private, no-store`.
- Dependencies: `@node-rs/argon2` 2.2.1, `@oslojs/crypto` 1.0.1, `@oslojs/encoding` 1.1.0 move to `apps/api/package.json`. Add `zod` (same pin as shared) and `cookie-parser` + types.

**Shared (`packages/shared/src/auth/`)**: `schemas.ts` (signup/login, `fieldErrorsOf`), `email.ts` (`normalizeEmail`), `messages.ts` (`MESSAGES`, including `tooManyAttempts`), `responses.ts` (`authSuccessSchema` `{redirectTo}`, `authErrorSchema` `{fieldErrors?, formError?}`, `meResponseSchema` `{id,email,name}`), re-exported from `index.ts` (CommonJS build as today).

**Web**:
- `LoginForm`/`SignupForm` + `use-auth-form.ts` keep `useActionState`, but its action becomes a client async function (`submit-auth.ts`) instead of a Server Action, so `SubmitButton`'s `useFormStatus` pending state and the double-submit guard keep working. It `fetch`es `POST /api/auth/…` as JSON, maps the error body into the same `AuthFormState`, and on success runs `router.replace(redirectTo)` + `router.refresh()`. The browser sends `Origin` itself; the cookie arrives through the rewrite.
- `RedirectIfSignedIn` calls `apiFetch("/auth/me")`: 200 → `redirect("/")`.
- Delete `actions.ts`, `lib/auth/**`, `lib/db.ts`, the pepper import in `instrumentation.ts` (delete the file if it ends up empty), and `ipThrottleBucket` from `lib/request-ip.ts` (`getClientIp` stays for the proxy).
- Remove the ESLint override and `@prisma/client`/argon2/oslojs from `apps/web/package.json`, and update api-foundation's `src/config/eslint-db-imports.test.ts` so no file is allowed.
- Env: `apps/web/.env.example` keeps only `API_URL` and `WEB_PROXY_SECRET`; `TEST_DATABASE_URL` moves to `apps/api/.env.example`.

**Order (deploy-order rule)**: the API endpoints land first and are purely additive. The web switches over after them, and the web deletions come last.

**Handoff to protected-routes**: its proxy cookie refresh (`refreshSessionCookie`) must not pick the cookie name from the web's `NODE_ENV` (always `production` under `next start`, while the e2e API runs with `NODE_ENV=test`). It takes the name rule from `packages/shared/src/session-cookie.ts`, the single source, and refreshes the cookie the API actually set rather than recomputing the name.

**Tests**: port `password`, `session`, `throttle`, `request-ip` (bucket) tests and `testing/fake-db.ts` into `apps/api/src/auth/`, and the `*.db.test.ts` (Postgres, `TEST_DATABASE_URL`). Turn `actions.test.ts` into `auth.controller.test.ts` + `auth.guard.test.ts` (Nest testing module, fake DB). The form tests mock `fetch`. `e2e/auth.spec.ts` stays and gains the AC5 cookie-attribute check. Playwright's API webServer runs without `NODE_ENV=production` (the Origin check needs `http://` for localhost). Locally the DB URL and pepper come from `apps/api/.env`, so e2e writes its unique-email users to the local `apps/api/.env` database; CI uses its Postgres service (api-foundation T22). `TEST_DATABASE_URL` only un-skips `auth.spec.ts` there.

## Out of Scope

- `callbackUrl` return-to, the login banner, header session state, `LogoutButton`, `getCurrentSession()`/`requireUser()` in `src/features/session/` and `packages/shared/src/session-cookie.ts` (protected-routes). Login/sign-up always return `redirectTo: "/"` here.
- Session listing/revoke, password change (session-management); auth event logging (auth-event-logging); the guest-cart merge itself (`onSignedIn` stays a stub).
- Submitting login/sign-up without JavaScript (logout still works without JS).
- Vercel and CI changes, and removing `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER` and `GUEST_CART_SECRET` from the web Vercel project (architecture.md Gotcha). Those are human steps after this ships; they follow api-foundation's deferred Vercel tasks.
- Any Prisma schema or migration change.

## Standards Applied

- [global/auth-security](../../../../../../standards/global/auth-security.md): only `apps/api/src/auth/` touches tokens, hashes and the cookie; `AuthGuard` is the authorization layer; new token at login/sign-up; POST-only changes; IP fail-open; Origin check; no secrets in logs.
- [global/tech-stack](../../../../../../standards/global/tech-stack.md): `apps/web` never imports Prisma or argon2; client forms write to `/api/*` (no Server Actions for data); shared Zod from `packages/shared`; the API ships first.

## Changelog

| Date | Author | Type | Change | Ref |
|---|---|---|---|---|
| 2026-10-13 | david-schwartzman | created | Initial shaping | — |
| 2026-10-15 | david-schwartzman | change | Technical Approach: the proxy-secret check runs first as an Express middleware in the new `apps/api/src/setup-app.ts`, before body parsing (it ran after it as AppModule middleware, so a malformed body without the secret got 400 instead of 401); body parsing is global in `common/body-parsing.ts`; guarded responses send `Cache-Control: private, no-store`; Covers adds `apps/api/src/setup-app.ts`; tests run against the local `apps/api/.env` database, and CI against its Postgres service; `authSuccessSchema.redirectTo` rejects `/\` (T30 #2); T32–T34 added — pre-PR review: auth-security standard (the proxy secret is checked before anything else) and doc accuracy | — |
| 2026-10-15 | david-schwartzman | change | AC5: the API's `NODE_ENV` picks the cookie name, so the web must not derive it from its own `NODE_ENV`; `packages/shared/src/session-cookie.ts` is the single source, with a handoff note for protected-routes' proxy refresh — `next start` is always production while the e2e API runs with `NODE_ENV=test`, so the names would disagree | — |
| 2026-10-15 | david-schwartzman | change | Covers adds `apps/api/src/common/body-parsing.ts` (created by T32); `references.md` lists every file this branch edits but doesn't own, checked against the branch diff — final review (N3) | — |
