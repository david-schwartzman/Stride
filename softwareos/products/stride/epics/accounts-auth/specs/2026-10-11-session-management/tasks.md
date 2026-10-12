# Tasks — Session Management

> Epic: accounts-auth
> Spec: 2026-10-11-session-management
> Branch: feat/accounts-auth/session-management

## Data

- [ ] T1 Add `publicId String @unique @default(dbgenerated("gen_random_uuid()::text"))` to `Session` in prisma/schema.prisma (app-foundation file, wiring edit) and generate prisma/migrations/<ts>_session_public_id/ with `prisma migrate dev --name session_public_id`. Check that the SQL backfills existing rows and that an insert without `publicId` still works, so a rollback to the previous deploy is safe (expand → contract).

## Tests first (TDD)

- [ ] T2 Write failing Vitest cases in src/lib/auth/session.test.ts. Cap: the 11th `createSession` deletes the least recently seen session in the same transaction, the new sign-in always succeeds, and this works with and without a passed `tx` (AC12). `validateSessionToken` writes `lastSeenAt` only when it's more than 1h old, in one update with sliding renewal when both apply, and does no write otherwise (AC9). `listSessions` returns `{ publicId, userAgent, createdAt, lastSeenAt }`, most recent first, with no `id` and no `ipAddress` (AC8). `revokeSessionByPublicId` returns 0 for another user's `publicId` and deletes nothing (AC10). `invalidateOtherSessions` keeps only `keepId` (AC11). `deleteExpiredSessions` removes rows with `expiresAt < now` or `createdAt` older than 90 days and returns the count (AC13). (testing skill)
- [ ] T3 Write failing Vitest cases in src/lib/auth/throttle.test.ts. The `pwchange:<userId>` key blocks after 5 failures in 15 min with the 1/2/4/8/15-minute backoff. It doesn't count toward or read the login `email:`/`ip:` keys, and the login keys don't count toward it. `clearPasswordChangeFailures` resets it (AC5). `pruneAuthAttempts(olderThan)` deletes only rows older than the cutoff and returns the count (AC13). (testing skill)
- [ ] T4 Write failing Vitest tables in src/features/account-security/schemas.test.ts and src/features/account-security/device-label.test.ts. `changePasswordSchema`: current password required and ≤128, new password 12–128, new equal to current refused with "Choose a password different from your current one." (AC3). `deviceLabel`: Chrome, Safari, Firefox and Edge on macOS, Windows, iOS, Android and Linux give "<Browser> on <OS>". Edge isn't misread as Chrome, and Chrome on iOS isn't misread as Safari. Null, empty or bot user agents give "Unknown device" (AC8). (testing skill)
- [ ] T5 Write failing Vitest cases in src/features/account-security/actions.test.ts for `changePasswordAction` (mock `requireUser` and the cookie module): per-field errors with passwords never echoed back (AC3, AC14); a wrong current password returns the AC4 error, records a `pwchange` failure and leaves the hash and sessions unchanged (AC4); throttled returns "Too many attempts, try again in N minutes." without calling `verifyPassword` (AC5); success writes a new hash + `pepperVersion`, deletes all sessions including the current one, creates one session with a new token, sets the cookie, clears the throttle and returns `{ ok: true }` (AC6); a failure inside the transaction rolls everything back and returns a generic error (AC7). Also `revokeSessionAction` (foreign or unknown `publicId` → `notFound()` and nothing deleted; current `publicId` refused; own `publicId` deleted; AC10) and `revokeOtherSessionsAction` (keeps the current session; with no session, `requireUser` redirects to login and `invalidateOtherSessions` is never called; AC11). (testing skill)
- [ ] T6 Write failing Vitest cases in src/app/api/cron/cleanup-sessions/route.test.ts. A missing header, a wrong secret, a wrong-length secret, a non-Bearer scheme and an unset `CRON_SECRET` each return 401 and call no delete. The correct Bearer secret returns 200 with `{ sessions, authAttempts }` counts, and `pruneAuthAttempts` gets a 24h cutoff. The handler never logs headers (AC13, AC14). (testing skill)
- [ ] T7 Write failing Playwright e2e/session-management.spec.ts: a logged-out visit to /account/security goes to `/login?callbackUrl=%2Faccount%2Fsecurity` and comes back after login (AC1); two browser contexts A and B sign in as the same user, A sees 2 rows with "This device" on one and no Sign out button on it, and the HTML has no session cookie value and no IP (AC8); A signs out of all other devices and B's next navigation lands on login; B signs in again, A changes the password, B is logged out, A stays signed in and sees the confirmation, the old password fails at login and the new one works (AC16). At a 375px-wide viewport, both sections render with no horizontal scroll and every button is visible (AC2). (testing skill)

## Auth module (signup-login files, wiring edits)

- [ ] T8 Edit src/lib/auth/session.ts. `createSession(token, userId, meta, tx?)` evicts sessions beyond the 10 most recently seen in the same transaction, opening its own `$transaction` when no `tx` is passed so login and sign-up get the cap unchanged (AC12). Merge the hourly `lastSeenAt` write into the renewal update in `validateSessionToken` (AC9). Add `listSessions`, `revokeSessionByPublicId`, `invalidateOtherSessions` and `deleteExpiredSessions`, each taking an optional `tx` (AC8, AC10, AC11, AC13). T2 goes green.
- [ ] T9 Edit src/lib/auth/throttle.ts. Add `checkPasswordChangeThrottle`, `recordPasswordChangeFailure` and `clearPasswordChangeFailures` on the key `pwchange:<userId>`, reusing the per-account limits and backoff (AC5). Add `pruneAuthAttempts(olderThan)` (AC13). T3 goes green.

## Feature module

- [ ] T10 Add src/features/account-security/schemas.ts (`changePasswordSchema`, shared by client and server; AC3)
- [ ] T11 Add src/features/account-security/device-label.ts (in-house user-agent → "Browser on OS" parser, "Unknown device" fallback, no new dependency; AC8). T4 goes green.
- [ ] T12 Add `changePasswordAction` in src/features/account-security/actions.ts (`"use server"`): `requireUser("/account/security")` → throttle check → `safeParse` → load `passwordHash` → `verifyPassword`. On failure, record the failure and return the AC4 error. On success, one `prisma.$transaction` that updates the hash + `pepperVersion`, deletes all of the user's sessions and calls `createSession(newToken, …, tx)`; then set the cookie with signup-login AC6's attributes, clear the throttle, `revalidatePath("/account/security")` and return `{ ok: true }`. Any other failure returns a generic error with no secrets (AC3–AC7, AC14).
- [ ] T13 Add `revokeSessionAction` (`requireUser`, Zod-parse `publicId`, refuse the current session's `publicId`, `revokeSessionByPublicId`, count 0 → `notFound()`) and `revokeOtherSessionsAction` (`requireUser("/account/security")` → `getCurrentSession()` → `invalidateOtherSessions(user.id, session.id)`) to src/features/account-security/actions.ts, both calling `revalidatePath` (AC10, AC11). T5 goes green.

## UI & page

- [ ] T14 Build src/features/account-security/ChangePasswordForm.tsx: client component with `useActionState` + `useFormStatus`, Zod on blur, `Input`/`Button` with visible labels, `autoComplete="current-password"` / `"new-password"`, hint "At least 12 characters.", per-field errors and the success message "Password changed. Other devices have been signed out." (AC2, AC3, AC6)
- [ ] T15 Build src/features/account-security/DeviceList.tsx (Server Component: one row per session with `deviceLabel`, "Last active <relative>", "Signed in <date>", "This device" on the current row, a no-JS `<form>` with hidden `publicId` + Sign out on the others) and src/features/account-security/SignOutOthersButton.tsx (rendered only when there's more than one session) (AC8, AC10, AC11)
- [ ] T16 Add src/app/account/security/page.tsx: Server Component calling `requireUser("/account/security")`, `getCurrentSession()` for the current `publicId`, and `listSessions`; renders both sections in the account-page styling (AccountOrders.dc.html), works at 375px, passes only `listSessions` fields to children (AC1, AC2, AC8). Flag to design (no mockup).

## Cron

- [ ] T17 Add src/app/api/cron/cleanup-sessions/route.ts: `export const dynamic = "force-dynamic"`, `GET` handler; unset `CRON_SECRET` → 401; length check then `crypto.timingSafeEqual`; `deleteExpiredSessions(now)` + `pruneAuthAttempts(now - 24h)`; 200 with counts; never logs headers. Confirm the proxy matcher in src/proxy.ts / src/middleware.ts doesn't redirect or set a cookie on /api/cron/** (AC13, AC14). T6 goes green.
- [ ] T18 Add `"crons": [{ "path": "/api/cron/cleanup-sessions", "schedule": "0 3 * * *" }]` to vercel.json (app-foundation file) and `CRON_SECRET=` (placeholder, not `NEXT_PUBLIC_`) to .env.example. Note in the PR that `CRON_SECRET` must be set to a long random value in Vercel Production, and crons run only on production deployments (AC13, AC14).

## Entry point

- [ ] T19 Add a temporary "Security" link to /account/security on the throwaway src/app/account/page.tsx placeholder (protected-routes file, not claimed; account-wishlist's account-profile replaces it)

## Docs (wiring edits)

- [ ] T20 Edit softwareos/products/stride/architecture.md: add the /account/security route, `CRON_SECRET` to the secrets list, and a Gotcha that the cron `GET` changes state as a documented exception (Bearer-authenticated, no cookie, no CSRF surface) and runs on production only, so previews rely on lazy expiry-on-lookup (AC14).
- [ ] T21 Edit softwareos/standards/global/auth-security.md: add `CRON_SECRET` to the secrets list, and a rule that cron Route Handlers authenticate with `Authorization: Bearer $CRON_SECRET`, compared in constant time and failing closed when unset (AC14). Order: PR #10's in-house session rules are already on `develop`; append this on top of them. auth-event-logging's T22 edits the same file after this, so don't rewrite other sections.

## Headers check

- [ ] T22 With security-headers merged, check that a signed-in GET of /account/security returns `Cache-Control` with `private` and `no-store`, and that the change-password and sign-out forms submit with zero CSP violations (`form-action 'self'`). Add these assertions to e2e/session-management.spec.ts. No header code in this spec (AC15).

## Verification

- [ ] T23 Run the full Vitest suite and Playwright e2e/session-management.spec.ts green in CI against Postgres, including the existing signup-login and protected-routes suites (they now go through the session cap and the `lastSeenAt` change) (testing skill)
- [ ] T24 (optional) Security review of the password change, session revocation and cron auth diff (security-reviewer agent)
- [ ] T25 Run QA against acceptance criteria (qa skill)
