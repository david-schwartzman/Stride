# QA Report — Sign-up & Login

> Spec: spec.md
> Date: 2026-10-13 · QA by: david-schwartzman · Mode: setup
> Verdict: PASS WITH NOTES
> Stale: spec changed 2026-10-13 (Acceptance Criteria) — rerun the qa skill

## Acceptance Criteria

| AC | Criterion | Result | Evidence |
|---|---|---|---|
| AC1 | `/signup` per the Signup design, works at 375px | pass | `src/app/(auth)/signup/page.tsx:19,27-32` (heading, "Already have an account? Log in" → /login); `src/features/auth/SignupForm.tsx:34,43,64-69` (Name/Email/Password, autocomplete, "At least 12 characters.", "Create account"); `SignupForm.test.tsx`, `AuthPanel.test.tsx`; production build checked at 1280px and 375px (scrollWidth 375, no h-scroll) |
| AC2 | `/login` per the Login design, works at 375px | pass | `src/app/(auth)/login/page.tsx:18-27` ("Log in", "New to Stride? Create an account" → /signup); `LoginForm.tsx:32,41`; `LoginForm.test.tsx`; checked at 1280px and 375px |
| AC3 | Valid sign-up creates one normalised User with an Argon2id + pepper hash, signs in, redirects / | pass | `src/features/auth/actions.ts:39-67`; `src/lib/auth/password.ts:35-38`; `actions.test.ts` "creates one user…"; `e2e/auth.spec.ts` journey (PR #20 CI run 38369953511, Postgres) |
| AC4 | Existing email (any case) → no user, inline Email error, "Log in" → /login | pass | `actions.ts:55-60` (P2002 from the unique index); `SignupForm.tsx:45-55`; `actions.test.ts` "refuses an existing email in any case…"; `SignupForm.test.tsx` "shows the existing-email error…"; e2e (CI) |
| AC5 | Wrong password / unknown email → Password-field error, no cookie | pass | `actions.ts:99-103`; `actions.test.ts` wrong-password + unknown-email cases; `LoginForm.test.tsx`; e2e "a wrong password shows inline…" (CI) |
| AC6 | Session cookie name/attributes, survives navigation + reload, `getCurrentSession()` returns `{id,email,name}` | pass | `src/lib/auth/cookie.ts:5,13,16-23`; `src/lib/auth/current.ts:10`; `session.ts` validate selects `{id,email,name}`; `cookie.test.ts`; e2e journey: httpOnly / Lax / Path=/, holds across reload (CI) |
| AC7 | Same Zod schemas client (on blur) + server; name required, valid email, 12–128 chars; per-field server errors | pass | `src/features/auth/schemas.ts`; `use-auth-form.ts` (blur + submit); `actions.ts:43,82`; `schemas.test.ts`; `actions.test.ts` "validates on the server when client validation is bypassed" |
| AC8 | Errors via `Input` `error` (aria-invalid + aria-describedby); pending state blocks double submit | pass | `src/components/ui/Input.tsx:42-43`; `SubmitButton.tsx:15,20`; form tests "validates a field on blur…", "shows a pending state and blocks double submit" |
| AC9 | `signOutAction` (POST) deletes the Session row, clears the cookie (same attrs, Max-Age=0), redirects /; signed-in users bounced off /login, /signup | pass | `actions.ts:111-113`; `src/lib/auth/sign-in.ts` `endSession`; `cookie.ts` delete with `attributes(0)`; `actions.test.ts` signOutAction cases; `RedirectIfSignedIn.tsx:7` + test; e2e uses the /login bounce as its signed-in proof (CI) |
| AC10 | `onSignedIn` called exactly once per sign-in; a throw is logged (no password) and sign-in still succeeds | pass | `hooks.ts:9`; `run-on-signed-in.ts:6-9`; `actions.ts:66,107`; `run-on-signed-in.test.ts`; `actions.test.ts` hook-once and hook-throws cases (log checked for the password) |
| AC11 | No passwords/tokens in logs, errors, form state or DB; e2e journey against real Postgres in CI | pass | Only log: `run-on-signed-in.ts:9` (userId + error); state never carries the password (`expectNoSecrets` in `actions.test.ts`); Session id = hash (`session.ts:53`); `e2e/auth.spec.ts` passed in CI against postgres:16 |
| AC12 | New random 256-bit token per sign-in; DB stores only sha256(token) + userId, expiresAt, UA, IP | pass | `session.ts:34-35,53`; `sign-in.ts` `startSession`; `session.test.ts`; `actions.test.ts` "creates a new token on every login…" |
| AC13 | 30-day sliding expiry, renew under 15 days, 90-day cap; expired = logged out + row deleted | pass | `session.ts:14-16,80,86`; `session.test.ts` (no renew at 14d, slide at 16d, 90-day cap, expired row deleted) |
| AC14 | Throttling: per-email back-off table, per-IP 30/15 min, sign-up 10/60 min, refused not recorded, unknown emails counted alike, success clears email only | pass | `src/lib/auth/throttle.ts:15-27,34,62,69,76-83,100`; `throttle.test.ts` (each delay step, case/whitespace variants, IP block, signup limit, null IP); `actions.test.ts` throttle cases |
| AC15 | Unknown email runs a dummy verify and is throttled exactly like a real account | pass | `actions.ts:99-101`; `password.ts` `verifyDummy`; `actions.test.ts` "treats an unknown email like a wrong password…" + "throttles an unknown email after 5 failures…" |
| AC16 | After `signOutAction`, a copy of the old token is rejected (Postgres integration test) | pass | `session.ts:103`; `session.test.ts`; `session.db.test.ts` ran against postgres:16 in PR #20 CI (146/146, 0 skipped) |

## Checks Run

- build: `npm run build` — pass (`/login`, `/signup` partially prerendered)
- lint: `npm run lint` (ESLint + Prettier) — pass
- typecheck: `npm run typecheck` — pass
- tests: `npm test` — pass locally (144 passed, 2 skipped: Postgres tests gated on `TEST_DATABASE_URL`); PR #20 CI — 146 passed, 0 skipped
- e2e: `npx playwright test` — pass locally (5 passed, 3 auth tests skipped without a database); PR #20 CI — 8 passed

## Issues Found

(none)

## Notes

- **Postgres-backed evidence comes from CI.** No local Postgres; AC3/AC6/AC9/AC11/AC16 database paths were verified in PR #20 CI run 38369953511 (postgres:16 service). Unit tests use an in-memory Prisma fake (`src/lib/auth/testing/fake-db.ts`).
- **Interpretations not spelled out in the spec** (flagged in the PR; change via `/spec-changes` if wanted):
  - Throttle refusals ("Too many attempts…", the sign-up limit) return a form-level `formError`, shown as an alert above the fields; the spec's return shape only lists per-field errors.
  - Validation copy: "Enter your name.", "Enter a valid email address.", "Use at least 12 characters.", "Use 128 characters or fewer."
  - "Too many attempts, try again in 1 minute." uses the singular when M = 1.
  - Per-IP block (AC14) holds the full 15 minutes after the 30th failure even after older failures leave the 15-minute window.
- **Cookie Max-Age isn't refreshed on session renewal** in this spec, by design (cookie writes only in Server Actions and the proxy). Until protected-routes ships its AC12 cookie refresh, a session is usable for at most 30 days from sign-in even though the database row slides.
- **Design follow-up:** `ProductArt` (decorative shoe illustration on the auth panel) isn't ported to React; the panel ships with its copy only.
- **Outside `> Covers:`:** `src/components/ui/Input.tsx` (`error` widened to `ReactNode` for the AC4 link); `prisma/schema.prisma`, `.github/workflows/ci.yml`, `package.json`/lock (planned hand-offs).
- **Deploy prerequisite:** `PASSWORD_PEPPER` must be set per environment in Vercel; `src/instrumentation.ts` refuses to start the server without a valid one (verified on the T18 preview).
- Hygiene: all non-cancelled tasks done once T14 is ticked with this report; no hotfix rows in the Changelog; `> PR:` recorded (#20, draft); spec status `in-progress` until merge.
