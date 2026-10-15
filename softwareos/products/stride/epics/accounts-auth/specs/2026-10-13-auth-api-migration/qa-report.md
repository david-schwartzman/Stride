# QA Report — Auth API Migration

> Spec: spec.md
> Date: 2026-10-13 · QA by: david-schwartzman · Mode: setup
> Verdict: PASS WITH NOTES
> Stale: spec changed 2026-10-15 (Acceptance Criteria, Technical Approach) — rerun the qa skill

## Acceptance Criteria

| AC | Criterion | Result | Evidence |
|---|---|---|---|
| AC1 | `AuthModule` exposes signup, login, logout and me; reached only as `/api/auth/*` behind proxy-secret and Origin middleware | pass | `apps/api/src/auth/auth.controller.ts:57-155`; `apps/api/src/app.module.ts:14,20` (`forRoutes("*")`); `auth.module.test.ts`; e2e journeys go through the web's `/api` rewrite; the built API answered 401 to `/auth/me` and `/auth/login` without the proxy secret |
| AC2 | Sign-up: one user, normalised email, Argon2id hash, new session, `onSignedIn` once, 200; 400 / 409 / 429 (limit before validation) | pass | `auth.controller.test.ts` "POST /auth/signup" (8 tests, incl. 429 on invalid bodies and incoming session ended); `on-signed-in.test.ts` |
| AC3 | Login: new 256-bit token, incoming session ended, failures cleared, `onSignedIn`; 401 same message and dummy hash, no cookie; 400; 429 back-off | pass | `auth.controller.test.ts` "POST /auth/login" (9 tests) and concurrency tests; `session.service.test.ts`; e2e "log in from a fresh browser" |
| AC4 | Throttles keep signup-login AC14 limits; IP only from `getClientIp`; `ipThrottleBucket` ported; null IP fails open | pass | `throttle.service.ts:39-41`; `throttle.service.test.ts`, `ip-bucket.test.ts`; null-IP tests in `auth.controller.test.ts`; `throttle.db.test.ts` on Postgres (see Notes 1) |
| AC5 | Cookie name and attributes; set/cleared only by `apps/api/src/auth/`; prod vs non-prod name | pass | `session-cookie.ts:14-30`; `session-cookie.test.ts`; "Set-Cookie attributes (AC5)" in `auth.controller.test.ts` (`__Host-` + Secure in production); `e2e/auth.spec.ts` asserts `stride_session`, HttpOnly, Lax, Path=/, host-only, not Secure, ~30 days |
| AC6 | Logout deletes the session, clears the cookie, 303 to `/`, works as a plain form POST, old token rejected, no GET | pass | "POST /auth/logout" in `auth.controller.test.ts` (4 tests incl. form POST and GET → 404); e2e native form POST: 303, cookie cleared, old token no longer signs in |
| AC7 | `GET /auth/me` via `AuthGuard`: 200 `{id,email,name}` only; 401 without user data; renewal re-sets Max-Age; 90-day cap; `@CurrentUser()` | pass | `auth.guard.ts:28-40`; `auth.guard.test.ts` (10 tests: valid, missing, empty, expired, revoked, tampered, hash-as-cookie, renewal Set-Cookie, cap); "GET /auth/me" tests; `Cache-Control: private, no-store` |
| AC8 | Schemas, `normalizeEmail`, `MESSAGES`, response schemas in `packages/shared/src/auth/`, used by web and API | pass | `packages/shared/src/auth/*.test.ts` (44 tests); web forms and `submit-auth.ts` and API controller/pipes import `@stride/shared`; web `schemas.ts` deleted |
| AC9 | `/login`, `/signup` behave as before; JSON `fetch` to `/api/auth/*`; navigate to `redirectTo`; no Server Actions | pass | `LoginForm.test.tsx`, `SignupForm.test.tsx`, `submit-auth.test.ts`; `submit-auth.ts:35`; 4 e2e auth journeys; no `"use server"` in `apps/web/src` |
| AC10 | Signed-in shopper on `/login` or `/signup` redirected to `/` via `apiFetch("/auth/me")` | pass | `RedirectIfSignedIn.tsx:8`; `RedirectIfSignedIn.test.tsx`; e2e `expectSignedIn` |
| AC11 | No Prisma, argon2, oslojs, password or session code in `apps/web`; files deleted; ESLint override gone; `.env.example` trimmed | pass | `src/lib/db.ts`, `src/lib/auth/`, `features/auth/actions.ts`, `instrumentation.ts` absent; `apps/web/package.json` has none of the packages; `eslint-db-imports.test.ts` rejects the imports everywhere; `apps/web/.env.example` lists only `API_URL`, `WEB_PROXY_SECRET` |
| AC12 | API refuses to start without a valid pepper, value never in the error; web no longer checks it | pass | `auth.module.ts:18`; `auth.module.test.ts` (missing, empty, short); `password.service.test.ts`; built API booted with the real pepper |
| AC13 | No password, token, cookie or raw body in API logs or `/auth/*` responses | pass | log-spy assertion after every `auth.controller.test.ts` test; "malformed JSON bodies" tests and `body-parsing.ts` (security review #1); `zod-body.pipe.test.ts`; `on-signed-in.test.ts` (see Notes 3) |
| AC14 | Unit and Postgres tests in `apps/api`; controller and guard tests; form tests mock `fetch`; e2e asserts the non-prod cookie | pass | `apps/api/src/auth/*.test.ts` (incl. `session.db.test.ts`, `throttle.db.test.ts`); `e2e/auth.spec.ts` 4/4 |
| AC15 | No regression: same Argon2 params, pepper, tables, no migration; lint, typecheck, test, test:e2e pass | pass | all repo checks green below; no Prisma schema or migration change in the diff; `password.service.test.ts` asserts `m=19456,t=2,p=1` (see Notes 2) |

## Checks Run

- build: `npm run build` — pass (shared, API `nest build`, web `next build`)
- lint: `npm run lint` — pass (ESLint in all workspaces + `prettier --check .`)
- typecheck: `npm run typecheck` — pass
- tests: `npm test` — pass (API 144 passed / 8 skipped, web 94 passed, shared 44 passed)
- e2e: `TEST_DATABASE_URL=… npm run test:e2e` — pass (10 passed: api-health, smoke, auth)

## Issues Found

(none) — no AC fails.

Deferred by the user from the T30 security review (low, non-blocking):

| # | Severity | Issue | Route |
|---|---|---|---|
| 1 | low | `submit-auth.ts` rejects `//` but not `/\` in `redirectTo` (only reachable via a tampered API response) | follow-up or /hotfix |
| 2 | low | Unhandled Prisma errors are logged in full by Nest's default handler (can include the password hash, not the password) | follow-up or /hotfix |

## Notes

1. The 8 Postgres tests (`*.db.test.ts`) were skipped in this run because the QA session cannot read the database URL. The user ran the root suite with `TEST_DATABASE_URL` set on 2026-10-13 23:16: 148/148 API tests passed. The session and throttle services have not changed since.
2. AC15's spot-check of an existing user's login could not be done: the Neon demo database had no accounts created before the migration. Argon2 parameters and the pepper are unchanged and covered by `password.service.test.ts`.
3. AC13 holds for passwords, tokens, cookies and raw bodies. The deferred low finding 2 concerns password **hashes** in logs of unexpected database errors.
4. The work was done on the local demo branch `feat/accounts-auth/auth-api-demo` (with PRs #20 and #21 merged into it), not the spec's `> Branch:` `feat/accounts-auth/auth-api-migration`. No PR is open.
5. There is no logout button in the UI yet (protected-routes owns `LogoutButton`); logout is verified at the API level and by e2e form POST.
6. Hygiene: all tasks T1–T30 are `[x]`; T31 is this run. The spec has no `hotfix` Changelog rows. `> Status:` is `in-progress`.
