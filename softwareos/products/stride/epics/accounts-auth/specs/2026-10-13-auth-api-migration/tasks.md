# Tasks — Auth API Migration

> Epic: accounts-auth
> Spec: 2026-10-13-auth-api-migration
> Branch: feat/accounts-auth/auth-api-migration

## Tests first (TDD)

- [x] T1 Write failing shared-contract tests (testing skill): move `apps/web/src/features/auth/schemas.test.ts` to `packages/shared/src/auth/schemas.test.ts`; add tests for `normalizeEmail`, `MESSAGES.tooManyAttempts` (1 vs several minutes), and parse tests for `authSuccessSchema`, `authErrorSchema`, `meResponseSchema` (AC8)
  - Done 2026-10-13 with the shared implementation it needs (`packages/shared/src/auth/`: `email`, `messages`, `schemas`, `responses`, re-exported from `index.ts`), since no other task creates it. The web keeps its own `schemas.ts`/`form-state.ts` until T19 switches the imports
- [x] T2 Port the auth unit tests into `apps/api/src/auth/` (testing skill) (AC4, AC12, AC14):
  - `password.service.test.ts`, `session.service.test.ts`, `throttle.service.test.ts` from `apps/web/src/lib/auth/*.test.ts`
  - `ip-bucket.test.ts` from the `ipThrottleBucket` block of `apps/web/src/lib/request-ip.test.ts`
  - `testing/fake-db.ts`, typed against `PrismaService`
  - `on-signed-in.test.ts` from `run-on-signed-in.test.ts`
  - a bad or missing `PASSWORD_PEPPER` makes `AuthModule` init throw, without the value in the message
- [x] T3 Port `session.db.test.ts` and `throttle.db.test.ts` to `apps/api/src/auth/` (`PrismaService` on `TEST_DATABASE_URL`, `describe.skipIf` when unset) (AC14, AC15)
- [x] T4 Write `apps/api/src/auth/auth.controller.test.ts` (testing skill; Nest testing module + fake DB), replacing `actions.test.ts` (AC2–AC6, AC13):
  - sign-up: 200 `{redirectTo:"/"}`; 400 `fieldErrors`; 409 `emailTaken`, no user; 429 `formError` (before validation); incoming session ended; `onSignedIn` throw logged, sign-up still succeeds
  - login: new token and incoming session ended; invalid body → 400 `fieldErrors`; failures cleared; 401 `fieldErrors.password` for unknown email and wrong password alike, dummy hash called, no `Set-Cookie`; 429 back-off message; null IP skips the per-IP limits
  - logout: 303 `Location: /`, session deleted, cookie cleared, old token rejected afterwards
  - `Set-Cookie` attributes in production and not (AC5)
  - no password, token or body in responses or the spied logger
- [x] T5 Write `apps/api/src/auth/auth.guard.test.ts` (testing skill): valid, missing, expired, revoked and tampered cookie; every 401 body has no user data; renewal re-sets Max-Age; 90-day cap; `GET /auth/me` and `@CurrentUser()` return only `{id,email,name}` (AC7)
  - Guard, renewal, cap and `@CurrentUser()` cases green with T15 (probe route in `auth.guard.test.ts`). The `GET /auth/me` assertion needs the controller, so it is in `auth.controller.test.ts` (T4)
- [x] T6 Rewrite the web tests to mock `fetch` (testing skill): `LoginForm.test.tsx` and `SignupForm.test.tsx` (plus `submit-auth.test.ts`) cover the JSON POST to `/api/auth/login|signup`, pending state and blocked double submit, field/form errors mapped from the response, name/email kept after an error, `router.replace(redirectTo)` + `router.refresh()`; `RedirectIfSignedIn.test.tsx` mocks `apiFetch` (AC9, AC10)
- [x] T7 Extend `apps/web/e2e/auth.spec.ts` (wiring edit; signup-login's test) (AC5, AC6, AC14):
  - assert the non-production cookie: `stride_session`, HttpOnly, SameSite=Lax, Path=/, no Domain (the production name and Secure flag are unit-tested in T4)
  - logout at the API level: a plain form POST to `/api/auth/logout` gets a 303 to `/`. The browser logout journey stays with protected-routes' AC11

## API auth module

- [x] T8 Add exact-pinned deps to `apps/api/package.json`: `@node-rs/argon2` 2.2.1, `@oslojs/crypto` 1.0.1, `@oslojs/encoding` 1.1.0, `zod` 4.6.6, `cookie-parser` + types. Register `cookieParser()` in `apps/api/src/main.ts` (wiring edit to an api-foundation file) (moved to `setup-app.ts` by T32) (AC5)
- [x] T9 Add `apps/api/src/auth/password.service.ts` (`getPepper`, `hashPassword`, `verifyPassword`, `DUMMY_HASH`, `verifyDummy`; m=19456, t=2, p=1). T2's password tests go green (AC12, AC15)
- [x] T10 Add `apps/api/src/auth/ip-bucket.ts` and `throttle.service.ts` with signup-login AC14's limits; the IP comes from `common/request-ip.ts` `getClientIp(req)` (AC4)
- [x] T11 Add `apps/api/src/auth/session.service.ts`, keeping sliding renewal, `updateMany` race handling and the 90-day cap (AC3, AC7)
- [x] T12 Add `apps/api/src/auth/session-cookie.ts`: name rule from `NODE_ENV`, set/clear via `res.cookie`/`res.clearCookie`, read (AC5)
- [x] T13 Add `apps/api/src/auth/on-signed-in.ts`: the `onSignedIn` stub and `runOnSignedIn` (swallows; logs only the userId and the error) (AC2, AC3, AC13)
- [x] T14 Add `apps/api/src/auth/zod-body.pipe.ts`: invalid body → 400 `{fieldErrors}` via the shared `fieldErrorsOf` (AC2, AC8)
- [x] T15 Add `apps/api/src/auth/auth.guard.ts` and `current-user.decorator.ts`. T5 goes green (AC7)
- [x] T16 Add `apps/api/src/auth/auth.controller.ts` (signup, login, logout, me), keeping today's order (sign-up: IP throttle before parse; login: parse → `recordLoginFailure` → check → withdraw); logout answers 303. T4 goes green (AC1–AC6, AC13)
- [x] T17 Add `apps/api/src/auth/auth.module.ts` (`onModuleInit` calls `getPepper()`) and import it in `apps/api/src/app.module.ts` (wiring edit); middleware order unchanged (moved to `setup-app.ts` by T32) (AC1, AC12)
- [x] T18 Wire env for tests and e2e (AC5, AC12, AC14, AC15):
  - `apps/api/.env.example`: add `TEST_DATABASE_URL`
  - `apps/web/playwright.config.ts` (wiring edit): the API webServer runs without `NODE_ENV=production`, since the Origin check accepts `http://localhost` only outside production. DB URL and pepper come from `apps/api/.env` locally, so e2e uses the local `apps/api/.env` database; CI uses its Postgres service (api-foundation T22). `TEST_DATABASE_URL` only un-skips `auth.spec.ts`

## Web switch to /api

- [x] T19 Point the web at the shared contract: `apps/web/src/features/auth/` imports schemas and `MESSAGES` from `@stride/shared`; delete `features/auth/schemas.ts`; `form-state.ts` keeps only the `AuthFormState` type (AC8)
- [x] T20 Add client `features/auth/submit-auth.ts` (POST JSON, map the response into `AuthFormState`) and use it as the `useActionState` action in `LoginForm.tsx`, `SignupForm.tsx` and `use-auth-form.ts`; `SubmitButton`'s pending state keeps working. T6 goes green (AC9)
- [x] T21 `RedirectIfSignedIn.tsx` calls `apiFetch("/auth/me")` and redirects to `/` on 200 (AC10)

## Web deletions

- [x] T22 Delete the web's server-side auth code (AC9, AC11, AC12):
  - `features/auth/actions.ts`, `actions.test.ts`, `hooks.ts`, `run-on-signed-in.ts` and its test
  - `src/lib/auth/**` and `src/lib/db.ts`
  - `src/instrumentation.ts` (empty once the pepper check goes)
  - `ipThrottleBucket` and its tests from `src/lib/request-ip.ts` (wiring edit; `getClientIp` stays)
- [x] T23 Remove the ESLint override in `apps/web/eslint.config.mjs` and update `src/config/eslint-db-imports.test.ts` so no file is allowed (wiring edits to api-foundation files) (AC11)
- [x] T24 (wiring edits to api-foundation files) Remove `@prisma/client`, `@node-rs/argon2` and `@oslojs/*` from `apps/web/package.json` and regenerate the root lockfile; remove `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER` and `TEST_DATABASE_URL` from `apps/web/.env.example` (AC11)

## Docs

- [x] T25 `softwareos/products/stride/architecture.md:43`: drop the temporary Prisma-in-web Gotcha; keep the human Vercel step to remove `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER` and `GUEST_CART_SECRET` from the web project (AC11)
- [x] T26 `softwareos/standards/global/auth-security.md:28`: remove the "Until `auth-api-migration` ships…" sentence
- [x] T27 `epics/accounts-auth/tech-plan.md`: line 56 candidate → shaped with a spec link; update line 21's parenthetical
- [x] T28 **(human-confirmed)** `/spec-changes` on the done specs:
  - `2026-10-08-signup-login`: drop the moved Covers paths, add `apps/web/` prefixes, reword AC9 for `POST /api/auth/logout`
  - `2026-10-08-app-foundation`: drop `src/lib/db.ts`

## Verification

- [x] T29 From the root, run lint, typecheck, test and test:e2e with `TEST_DATABASE_URL` set (`*.db.test.ts` and `e2e/auth.spec.ts` run); spot-check an existing user's login (AC14, AC15)
  - Done 2026-10-13: lint, typecheck, test (API 148 incl. the 8 Postgres tests on the local `apps/api/.env` database, web 94, shared 44) and test:e2e (10/10, both apps). Existing-user spot-check not possible: the database had no pre-migration accounts; the Argon2 parameters and pepper are unchanged (password.service.test.ts)
- [x] T30 Security review (security-reviewer agent) of `apps/api/src/auth/**`, the `main.ts`/`app.module.ts` changes and the web fetch path (AC3–AC7, AC12, AC13)
  - 2026-10-13 review: APPROVE WITH NOTES (0 critical, 0 high, 1 medium, 3 low). Findings: #1 medium, malformed JSON echoed the body (fixed; now `common/body-parsing.ts`, wired in `setup-app.ts`, see T32). #2 low, backslash `redirectTo` (deferred, then fixed in T33). #3 low, `GET /auth/me` / AuthGuard cacheable (fixed: `Cache-Control: private, no-store`). #4 low, Prisma error logging (deferred by the user)
- [x] T31 Run QA against acceptance criteria AC1–AC15 (qa skill)

## Pre-PR review fixes (Changelog 2026-10-15)

- [x] T32 Run the proxy-secret check as the first Express middleware, before body parsing (`apps/api/src/setup-app.ts`, called by `main.ts`; wiring edits to api-foundation files); remove it from `AppModule.configure`, keep the Origin check there; move `body-parsing.ts` to `apps/api/src/common/`, keeping the login/sign-up empty-form answer in `auth/malformed-body.ts`; add `auth.wiring.test.ts` (real `AppModule`, Prisma stubbed): no secret → 401 with an empty body, malformed body included; secret + foreign Origin → the Origin middleware's rejection; the handler never runs (AC1, AC13)
- [x] T33 `authSuccessSchema.redirectTo` matches `^\/(?![\/\\])`; `submit-auth.ts` relies on it; tests in `responses.test.ts` and `submit-auth.test.ts` (T30 #2) (AC9)
- [x] T34 Re-run QA against AC1–AC15 at the branch tip with `TEST_DATABASE_URL` set (qa skill)
  - Done 2026-10-15 (re-run after T35): PASS WITH NOTES. lint, typecheck, build and test pass (API 161 + 8 skipped, web 105, shared 59). No `TEST_DATABASE_URL` locally, so the 8 Postgres tests and the e2e auth journeys did not run here; they run in CI (qa-report.md Notes 1–2)

## Final review fixes (Changelog 2026-10-15)

- [x] T35 `authSuccessSchema.redirectTo` rejects control characters and requires the path to resolve to the same origin (security review LOW-1); tests in `responses.test.ts` (`/\t/evil.com`, `/\n\evil.com`, `/\r//evil.com`, `//evil.com`, `/\evil.com`, NUL/DEL, valid paths with query strings) and `submit-auth.test.ts` (AC8, AC9)
