# Session Management

> Epic: ../../epic.md
> Status: shaped
> Branch: feat/accounts-auth/session-management
> Covers: /account/security, src/app/account/security/**, src/features/account-security/**, src/app/api/cron/cleanup-sessions/**, e2e/session-management.spec.ts, prisma/migrations/*_session_public_id/**

## Overview

Fifth spec of Accounts & Auth, from the tech plan's candidate list (tech-plan.md:45). It hardens the epic after the core work. It is not one of the brief's success criteria and not required for launch. It serves the brief's goal "A secure session" (product-brief.md:10) and adds no new success criterion. Shoppers can see every place they're signed in and sign any of them out. Changing the password while signed in requires the current password and signs out every other device. Sessions are capped at 10 per shopper, and a nightly Vercel Cron job deletes expired sessions and old auth attempts.

Builds on `signup-login` (`src/lib/auth/` session, password and throttle modules, the `Session` model) and `protected-routes` (`requireUser()`, the `/account` prefix guard, `callbackUrl`). Both must be merged first. `security-headers` should merge first too: `/account/security` gets its `Cache-Control: private, no-store` and CSP `form-action 'self'` from it with no extra code. All three changes to signup-login's auth module are wiring edits to files this spec doesn't claim. The same goes for `prisma/schema.prisma`, app-foundation's `vercel.json` and `.env.example`, and protected-routes' throwaway `/account` placeholder.

New route `/account/security`: change password + "Your devices". There are no designs for it, so it reuses `Input`/`Button` and the account-page styling (`AccountOrders.dc.html`), and is flagged to design. account-wishlist's real `/account` page should link to it. Until then, the `/account` placeholder carries a temporary "Security" link.

## Goals & User Stories

- As a shopper, I can see every device I'm signed in on, with the browser, OS and when it was last active, so I can spot one I don't recognise.
- As a shopper, I can sign out one device, or all devices except this one.
- As a shopper who suspects someone is in my account, I can change my password. That signs out every other device and keeps me signed in here.
- As a shopper on an unlocked shared laptop, I'm protected: nobody can change my password without knowing the current one.
- As the store, old sessions and auth attempts don't pile up, and no shopper has more than 10 live sessions.

## Acceptance Criteria

1. AC1: A logged-out visit to `/account/security` redirects to `/login?callbackUrl=%2Faccount%2Fsecurity` and returns there after login. The page itself calls `requireUser("/account/security")`, so an expired or revoked session also lands on login.
2. AC2: The page shows a "Change password" section and a "Your devices" section, built from `Input`/`Button`, with visible labels, and works at 375px.
3. AC3: The change-password form has Current password (`autocomplete="current-password"`) and New password (`autocomplete="new-password"`, hint "At least 12 characters."). One Zod schema validates on the client (on blur) and on the server: current password required (≤128), new password 12–128, and a new password equal to the current one is refused with "Choose a password different from your current one." Server failures come back as per-field errors, and passwords are never echoed back.
4. AC4: A wrong current password shows "That password isn't right. Try again." inline on Current password. The password hash and the sessions are unchanged.
5. AC5: After 5 wrong current-password attempts for a user within 15 minutes, further attempts get "Too many attempts, try again in N minutes." with login's increasing delay (1, 2, 4, 8, up to 15 min). The counter is keyed `pwchange:<userId>` and is separate from the login counters. Success clears it.
6. AC6: On success, `passwordHash` becomes a new Argon2id + pepper hash. **Every** session of the user is deleted, including the current one. A new session with a **new** random token is created for this device, and the cookie is set with signup-login AC6's attributes. The page confirms "Password changed. Other devices have been signed out." The old cookie value, and every other device, is then treated as logged out. The old password no longer logs in and the new one does.
7. AC7: The hash update, deleting every session and creating the new session happen in one database transaction. On failure nothing changes, and a generic error shows.
8. AC8: "Your devices" lists one row per session of the user, most recently active first: "<Browser> on <OS>" parsed from `userAgent` ("Unknown device" when it can't be parsed), "Last active <relative time>" from `lastSeenAt`, and "Signed in <date>". The current session is marked "This device". Rows are identified only by `Session.publicId`. The token, `sha256(token)` (`Session.id`) and the IP never reach the HTML or the RSC payload.
9. AC9: Session validation (`validateSessionToken`) updates `lastSeenAt` only when it's more than 1 hour old, in the same write as sliding renewal when both apply, so reads mostly stay reads.
10. AC10: "Sign out" on a row POSTs its `publicId` and deletes that session only if it belongs to the session user. An unknown `publicId`, or one owned by another user, returns 404 and deletes nothing. The current device's row has no Sign out button, and the action refuses the current `publicId` (Log out in the header covers that). The revoked device is logged out on its next request.
11. AC11: "Sign out of all other devices" (shown only when there's more than one session) deletes every session of the user except the current one. This device stays signed in. Called with no valid session, the action redirects to login and deletes nothing.
12. AC12: After any sign-in (login, sign-up or password change) the user has at most 10 sessions. When an 11th is created, the least recently seen one is deleted in the same transaction, and the new sign-in always succeeds.
13. AC13: `GET /api/cron/cleanup-sessions` with `Authorization: Bearer <CRON_SECRET>` deletes sessions with `expiresAt < now` or `createdAt` older than 90 days, and `AuthAttempt` rows older than 24 hours (the longest throttle window is 60 minutes, sign-up per IP). It returns 200 with the deleted counts. A missing or wrong header, or an unset `CRON_SECRET`, returns 401 and deletes nothing. The comparison is constant-time. `vercel.json` schedules it daily (`0 3 * * *`), which works on Hobby (once a day, imprecise time) and Pro.
14. AC14: `CRON_SECRET` is in `.env.example` as a placeholder, is never a `NEXT_PUBLIC_` variable, and is added to the secrets lists in `architecture.md` and `auth-security.md`. Passwords, tokens, cookies, session hashes and raw form data never appear in logs, returned form state or error messages.
15. AC15: `/account/security` responses carry `Cache-Control` with `private` and `no-store`, and both forms submit under the CSP (both come from security-headers; this spec adds no header code).
16. AC16: Playwright passes in CI against a real Postgres. It signs the same user in on two browser contexts A and B; A's devices list shows 2 rows; A signs out "other devices" and B's next navigation lands on login. Then it signs B in again, changes the password in A, and checks that B is logged out, A is still signed in, the old password fails at login and the new one works.

## Technical Approach

- **Data (wiring edit to `prisma/schema.prisma`):** add `publicId String @unique @default(dbgenerated("gen_random_uuid()::text"))` to `Session`. Use `prisma migrate dev --name session_public_id`. The DB-side default backfills existing rows and keeps inserts from the previous deploy working (expand → contract: a client-side `@default(cuid())` would break a Vercel rollback). `publicId` is the only session identifier sent to the browser.
- **Auth module edits (signup-login's `src/lib/auth/`, not claimed):**
  - `session.ts`:
    - `createSession(token, userId, meta, tx?)` enforces the cap: after the insert, it deletes the user's sessions beyond the 10 most recently seen, in one transaction (AC12).
    - `validateSessionToken` also sets `lastSeenAt = now` when it's older than 1h, merged with the renewal update (AC9).
    - New: `listSessions(userId)` returns `{ publicId, userAgent, createdAt, lastSeenAt }` with no id and no IP. `revokeSessionByPublicId(userId, publicId)` does `deleteMany({ where: { publicId, userId } })` and returns the count. `invalidateOtherSessions(userId, keepId)`. `deleteExpiredSessions(now)`.
    - Helpers take an optional Prisma `tx` so change password can compose them.
  - `throttle.ts`: `checkPasswordChangeThrottle(userId)`, `recordPasswordChangeFailure(userId)` and `clearPasswordChangeFailures(userId)` on the key `pwchange:<userId>`, reusing the per-account limits (AC5). `pruneAuthAttempts(olderThan)`.
  - `password.ts` is unchanged: change password calls the existing `hashPassword` / `verifyPassword`.
- **Feature module `src/features/account-security/`:**
  - `schemas.ts` holds `changePasswordSchema`.
  - `device-label.ts` is a small in-house UA → "Browser on OS" parser (Chrome/Safari/Firefox/Edge × macOS/Windows/iOS/Android/Linux, else "Unknown device"). No new dependency.
  - `actions.ts` (`"use server"`):
    - `changePasswordAction`: `requireUser`, throttle check, `safeParse`, load `passwordHash`, `verifyPassword(current)`. On failure, record the failure and return the AC4 error. On success, one `prisma.$transaction`: update `passwordHash` + `pepperVersion`, delete all of the user's sessions, `createSession(newToken)`. Then set the cookie (Server Action, per architecture.md: Server Components can't set cookies), clear the throttle, `revalidatePath`, and return `{ ok: true }`.
    - `revokeSessionAction`: `requireUser`, Zod-parse `publicId`, refuse the current session's `publicId`, `revokeSessionByPublicId`. A count of 0 → `notFound()` (404, not 403; never trust client IDs).
    - `revokeOtherSessionsAction`: `requireUser("/account/security")` first (it redirects to login when there's no session, so nothing below runs). Then `getCurrentSession()` for the current session's `id` → `invalidateOtherSessions(user.id, session.id)`. The user ID always comes from `requireUser()`, never from the session lookup alone.
  - UI: `ChangePasswordForm.tsx` (client: `useActionState` + `useFormStatus`, Zod on blur), `DeviceList.tsx` (Server Component, a no-JS `<form>` per row, current row marked), `SignOutOthersButton.tsx`.
- **Page:** `src/app/account/security/page.tsx` (Server Component): `requireUser("/account/security")`, `getCurrentSession()` for the current session's `publicId`, and `listSessions`.
- **Cron:** `src/app/api/cron/cleanup-sessions/route.ts`. `export const dynamic = "force-dynamic"` with a `GET` handler, because Vercel Cron sends a GET with `Authorization: Bearer $CRON_SECRET`. If `CRON_SECRET` is unset, fail closed with 401. Compare with `crypto.timingSafeEqual` (after a length check). Call `deleteExpiredSessions` + `pruneAuthAttempts(24h)` and return the counts. Never log headers.
  - This is a documented exception to "GET never changes state": it isn't cookie-authenticated, so it has no CSRF surface.
  - Crons run only on production deployments. Previews rely on lazy deletion on lookup.
  - Wiring edits: add `"crons": [{ "path": "/api/cron/cleanup-sessions", "schedule": "0 3 * * *" }]` to app-foundation's `vercel.json`, and add `CRON_SECRET=` to `.env.example`. `CRON_SECRET` is set in Vercel production (a long random value).
- **Docs (wiring edits):** add the `/account/security` route and `CRON_SECRET` to `architecture.md`, plus a Gotcha on the cron exception. In `auth-security.md`, add `CRON_SECRET` to the secrets list and a line saying cron Route Handlers authenticate with the Bearer secret.
- **Order of `auth-security.md` edits:** three changes touch this standard. (1) The in-house session rules from PR #10 are already merged on `develop`. (2) This spec's T21 adds the `CRON_SECRET` rules. (3) auth-event-logging's T22 adds the auth-event rules. Make them in that order: build T21 on top of `develop`, and auth-event-logging's T22 goes on top of T21. Each one appends to its own section and doesn't rewrite the others.
- **Entry point:** a temporary "Security" link on protected-routes' `/account` placeholder. account-wishlist's `account-profile` replaces it with a real link.
- **Tests:** Vitest for the session helpers (cap eviction order, lastSeenAt hourly rule, revoke scoped to the user, invalidateOthers, deleteExpired), the throttle keys, device-label, the actions (wrong current password, throttle, the success path rotating sessions, a foreign `publicId` → 404) and the cron handler (401 cases, deletes). Playwright `e2e/session-management.spec.ts` covers AC16.

## Out of Scope

- Password reset / forgot password (epic Out of Scope; no email provider).
- "New sign-in" emails and email notification of a password change (no email provider).
- Auth event logging for revoke and password change (candidate `auth-event-logging`).
- Showing IP or location in the devices list.
- The real `/account` page and its link to Security (account-wishlist / account-profile).
- Account deletion. Admin revocation of another user's sessions.
- Pepper rotation tooling (signup-login Out of Scope).
- Security headers themselves (security-headers).

## Standards Applied

- [global/auth-security](../../../../../../standards/global/auth-security.md): `requireUser()` in every action and the page, user ID only from the session, a foreign `publicId` → 404, a new token on password change, POST-only changes, only `src/lib/auth/` touches tokens and hashes, `CRON_SECRET` handling, no secrets in logs.
- [global/tech-stack](../../../../../../standards/global/tech-stack.md): Server Actions + Zod on client and server, a Route Handler only for the cron, an expand → contract migration, Vitest + Playwright.
- [global/git-workflow](../../../../../../standards/global/git-workflow.md): branch off `develop`, PR to `develop`, `feat(accounts-auth): …` commits.

## Changelog

| Date | Author | Type | Change | Ref |
|---|---|---|---|---|
| 2026-10-11 | david-schwartzman | created | Initial shaping | — |
| 2026-10-12 | david-schwartzman | revised | PR review: `revokeOtherSessionsAction` calls `requireUser()` first (AC11 no-session case); explicit order of `auth-security.md` edits; 375px viewport check in e2e; security-plan sections copied into the repo | PR #15 |
| 2026-10-12 | david-schwartzman | revised | PR review: AC13 retention reason now cites the 60-minute sign-up-per-IP window (signup-login AC14) | PR #19 |
