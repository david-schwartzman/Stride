# QA Report — Auth API Migration

> Spec: spec.md
> Date: 2026-10-15 · QA by: david-schwartzman · Mode: setup
> Verdict: PASS WITH NOTES

## Acceptance Criteria

| AC | Criterion | Result | Evidence |
|---|---|---|---|
| AC1 | `AuthModule` exposes signup, login, logout and me; reached only as `/api/auth/*` behind proxy-secret and Origin middleware | pass | `auth.controller.ts:57-154`; `setup-app.ts:23` (proxy secret, the first Express middleware, before body parsing); `app.module.ts:20` (Origin check, `forRoutes("*")`); `auth.wiring.test.ts` (11 tests, real `AppModule`): no or wrong secret → 401 with an empty body, malformed body included; secret + foreign Origin → the Origin middleware's own status; the handler never runs; `auth.module.test.ts` |
| AC2 | Sign-up: one user, normalised email, Argon2id hash, new session, `onSignedIn` once, 200; 400 / 409 / 429 (limit before validation) | pass | `auth.controller.test.ts` "POST /auth/signup" (incl. 429 on invalid bodies, incoming session ended, hook failure logged); `on-signed-in.test.ts` |
| AC3 | Login: new 256-bit token, incoming session ended, failures cleared, `onSignedIn`; 401 same message and dummy hash, no cookie; 400; 429 back-off | pass | `auth.controller.test.ts` "POST /auth/login" and concurrency tests; `session.service.test.ts` |
| AC4 | Throttles keep signup-login AC14 limits; IP only from `getClientIp`; `ipThrottleBucket` ported; null IP fails open | pass | `auth.controller.ts:73,112` (`getClientIp(req)`); `throttle.service.test.ts`, `ip-bucket.test.ts`; null-IP tests in `auth.controller.test.ts`. `throttle.db.test.ts` skipped in this run (Notes 1) |
| AC5 | Cookie name and attributes; set/cleared only by `apps/api/src/auth/`; the rule lives today in `apps/api/src/auth/session-cookie.ts` (API `NODE_ENV`) | pass | `session-cookie.ts:13-42`; `session-cookie.test.ts`; "Set-Cookie attributes (AC5)" in `auth.controller.test.ts` (`__Host-` + Secure in production, `stride_session` otherwise). Moving the rule to `packages/shared` and the proxy's detection of either name are protected-routes' (its AC12, T3). The e2e cookie check did not run (Notes 2) |
| AC6 | Logout deletes the session, clears the cookie, 303 to `/`, works as a plain form POST, old token rejected, no GET | pass | "POST /auth/logout" in `auth.controller.test.ts` (form POST, GET → 404); `auth.wiring.test.ts` "reaches the logout handler (303 to /)" through the full pipeline |
| AC7 | `GET /auth/me` via `AuthGuard`: 200 `{id,email,name}` only; 401 without user data; renewal re-sets Max-Age; 90-day cap; `@CurrentUser()` | pass | `auth.guard.ts:28` (`Cache-Control: private, no-store` on guarded responses); `auth.guard.test.ts` (valid, missing, empty, expired, revoked, tampered, hash-as-cookie, renewal Set-Cookie, cap); "GET /auth/me" tests |
| AC8 | Schemas, `normalizeEmail`, `MESSAGES`, response schemas in `packages/shared/src/auth/`, used by web and API | pass | `packages/shared/src/auth/*.test.ts` (shared suite 59 tests, incl. `authSuccessSchema` rejecting `//host`, `/\host`, tab/CR/LF variants such as `/\t/evil.com`, NUL and DEL, and accepting paths with query strings); web forms, `submit-auth.ts` and the API import `@stride/shared` |
| AC9 | `/login`, `/signup` behave as before; JSON `fetch` to `/api/auth/*`; navigate to `redirectTo`; no Server Actions | pass | `submit-auth.ts:35`; `LoginForm.test.tsx`, `SignupForm.test.tsx`, `submit-auth.test.ts` (incl. off-site, `//`, `/\` and tab `redirectTo` throw); no `"use server"` in `apps/web/src`. Browser journeys not run (Notes 2) |
| AC10 | Signed-in shopper on `/login` or `/signup` redirected to `/` via `apiFetch("/auth/me")` | pass | `RedirectIfSignedIn.tsx:8`; `RedirectIfSignedIn.test.tsx` |
| AC11 | No Prisma, argon2, oslojs, password or session code in `apps/web`; files deleted; ESLint override gone; `.env.example` trimmed | pass | `src/lib/db.ts`, `src/lib/auth/`, `features/auth/actions.ts`, `instrumentation.ts` absent; `apps/web/package.json` has none of the packages; `eslint-db-imports.test.ts`; `apps/web/.env.example` lists only `API_URL`, `WEB_PROXY_SECRET` |
| AC12 | API refuses to start without a valid pepper, value never in the error; web no longer checks it | pass | `auth.module.ts:18`; `auth.module.test.ts` (missing, empty, short); `password.service.test.ts`; the built API booted for e2e with a generated pepper |
| AC13 | No password, token, cookie or raw body in API logs or `/auth/*` responses | pass | log-spy assertion after every `auth.controller.test.ts` test; "malformed JSON bodies" tests (`common/body-parsing.ts`, `auth/malformed-body.ts`); `auth.wiring.test.ts` (no secret → empty 401, malformed body never parsed; with the secret → empty-form 400 that doesn't quote the body); `zod-body.pipe.test.ts`; `on-signed-in.test.ts` |
| AC14 | Unit and Postgres tests in `apps/api`; controller and guard tests; form tests mock `fetch`; e2e asserts the non-prod cookie | not verifiable | Unit, controller, guard, wiring and form tests pass. The 8 Postgres tests (`session.db.test.ts`, `throttle.db.test.ts`) and `e2e/auth.spec.ts` were skipped: no database was reachable from this run (Notes 1, 2) |
| AC15 | No regression: same Argon2 params, pepper, tables, no migration; lint, typecheck, test, test:e2e pass | not verifiable | lint, typecheck, test and build pass; no Prisma schema or migration change in the diff; `password.service.test.ts` asserts `m=19456,t=2,p=1`. test:e2e could not pass without a database (Notes 2, 3) |

## Checks Run

- build: `API_URL=http://127.0.0.1:4000 WEB_PROXY_SECRET=ci-build-placeholder npm run build` — pass (placeholder values). Without them, `next build` fails prerendering `/signup`: `apiFetch` throws when its env is missing (Notes 4)
- lint: `npm run lint` — pass (ESLint in all workspaces + `prettier --check .`)
- typecheck: `npm run typecheck` — pass
- tests: `npm test` — pass: API 161 passed / 8 skipped (169), web 105 passed, shared 59 passed. 325 passed in total; the 8 skipped are the Postgres tests (Notes 1)
- e2e: `PASSWORD_PEPPER=<generated> npm run test:e2e` — 5 passed (smoke), 4 skipped (`auth.spec.ts`, no `TEST_DATABASE_URL`), 1 failed (`api-health.spec.ts`: 503 because no database is reachable)

## Issues Found

No AC fails.

Open from the T30 security review (numbers as in that review; #1, #2 and #3 are fixed, and the final review's LOW-1, control characters in `redirectTo`, is fixed by T35):

| # | Severity | Issue | Route |
|---|---|---|---|
| 4 | low | Unhandled Prisma errors are logged in full by Nest's default handler (can include the password hash, not the password). Deferred by the user | follow-up or /hotfix |

## Notes

1. **Not run locally:** `TEST_DATABASE_URL` was not available to this run (the QA session cannot read `apps/api/.env`, and no local Postgres was installed), so the 8 Postgres tests (`session.db.test.ts`, `throttle.db.test.ts`) were skipped. They run in CI against its Postgres service (`.github/workflows/ci.yml`), which gives the full count of 169 API tests.
2. **Not run locally:** e2e ran without a database, using a generated pepper, so the API booted, but `/health` answered 503 and `auth.spec.ts` skipped. The e2e auth journeys, the e2e cookie-attribute check (AC5) and the plain-form logout e2e (AC6) did not run at this tip. They run in CI, where `TEST_DATABASE_URL` is set and the Postgres service is up.
3. AC15's spot-check of an existing user's login was not done: no database was reachable. The Argon2 parameters and the pepper are unchanged, covered by `password.service.test.ts`.
4. `next build` needs `API_URL` and `WEB_PROXY_SECRET` in its env, because `RedirectIfSignedIn` calls `apiFetch` while `/signup` and `/login` prerender. This is unchanged by this spec's fixes. Local builds read them from `apps/web/.env`, and CI must set them.
5. Since the last report: api-foundation's final fixes are merged in, so the OriginCheckMiddleware rejects with 401 (`origin-check.middleware.ts:23,28`); `auth.wiring.test.ts` asks the middleware for its status and passes. `redirectTo` now also rejects control characters and off-origin paths (T35), and the spec's AC5 and the protected-routes handoff were clarified (Changelog 2026-10-15).
6. There is no logout button in the UI yet (protected-routes owns `LogoutButton`). Logout is verified at the API level and through the full pipeline in `auth.wiring.test.ts`.
7. Hygiene: tasks T1–T33 and T35 are `[x]`, and T34 is this run. The spec has no `hotfix` Changelog rows. `> Status:` is `in-progress`, and stays so until this spec's PR and the PRs it is stacked on (api-foundation, #20, #21) are merged and CI is green. tasks.md has no `> PR:` line yet.
