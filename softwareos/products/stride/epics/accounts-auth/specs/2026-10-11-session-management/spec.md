# Session Management

> Epic: ../../epic.md
> Status: shaped
> Branch: feat/accounts-auth/session-management
> Covers: /account/security, apps/web/src/app/account/security/**, apps/web/src/features/account-security/**, packages/shared/src/account-security/**, apps/api/src/account-security/**, apps/api/src/cron/**, apps/web/e2e/session-management.spec.ts, apps/api/prisma/migrations/*_session_public_id/**

## Overview

Fifth spec of Accounts & Auth, from the tech plan's candidate list (tech-plan.md:45). It hardens the epic after the core work. It is not one of the brief's success criteria and not required for launch. It serves the brief's goal "A secure session" (product-brief.md:10) and adds no new success criterion. Shoppers can see every place they're signed in and sign any of them out. Changing the password while signed in requires the current password and signs out every other device. Sessions are capped at 10 per shopper, and a nightly Vercel Cron job deletes expired sessions and old auth attempts.

Builds on `signup-login` (the session, password and throttle services, the `Session` model — in the NestJS API's `apps/api/src/auth/` once candidate `auth-api-migration` lands) and `protected-routes` (`requireUser()`, the API `AuthGuard`, the `/account` prefix guard, `callbackUrl`). Both must be merged first, and `api-foundation` before them (the backend moved to a separate NestJS API on 2026-10-13). `security-headers` should merge first too: `/account/security` gets its `Cache-Control: private, no-store` and CSP `form-action 'self'` from it with no extra code. All three changes to signup-login's auth module are wiring edits to files this spec doesn't claim. The same goes for the API's `prisma/schema.prisma`, the API project's `vercel.json` and `.env.example`, and protected-routes' throwaway `/account` placeholder.

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
3. AC3: The change-password form has Current password (`autocomplete="current-password"`) and New password (`autocomplete="new-password"`, hint "At least 12 characters."). One Zod schema validates on the client (on blur) and on the server: current password required (≤128), new password 12–128, and a new password equal to the current one is refused with "Choose a password different from your current one." API validation failures come back as per-field errors, and passwords are never echoed back.
4. AC4: A wrong current password shows "That password isn't right. Try again." inline on Current password. The password hash and the sessions are unchanged.
5. AC5: After 5 wrong current-password attempts for a user within 15 minutes, further attempts get "Too many attempts, try again in N minutes." with login's increasing delay (1, 2, 4, 8, up to 15 min). The counter is keyed `pwchange:<userId>` and is separate from the login counters. Success clears it.
6. AC6: On success, `passwordHash` becomes a new Argon2id + pepper hash. **Every** session of the user is deleted, including the current one. A new session with a **new** random token is created for this device, and the cookie is set with signup-login AC6's attributes. The page confirms "Password changed. Other devices have been signed out." The old cookie value, and every other device, is then treated as logged out. The old password no longer logs in and the new one does.
7. AC7: The hash update, deleting every session and creating the new session happen in one database transaction. On failure nothing changes, and a generic error shows.
8. AC8: "Your devices" lists one row per session of the user, most recently active first: "<Browser> on <OS>" parsed from `userAgent` ("Unknown device" when it can't be parsed), "Last active <relative time>" from `lastSeenAt`, and "Signed in <date>". The current session is marked "This device". Rows are identified only by `Session.publicId`. The token, `sha256(token)` (`Session.id`) and the IP never reach the HTML or the RSC payload.
9. AC9: Session validation (`validateSessionToken`) updates `lastSeenAt` only when it's more than 1 hour old, in the same write as sliding renewal when both apply, so reads mostly stay reads.
10. AC10: "Sign out" on a row POSTs its `publicId` to `/api/account/sessions/revoke` and the API deletes that session only if it belongs to the session user. An unknown `publicId`, or one owned by another user, returns 404 and deletes nothing. The current device's row has no Sign out button, and the endpoint refuses the current `publicId` (Log out in the header covers that). The revoked device is logged out on its next request.
11. AC11: "Sign out of all other devices" (shown only when there's more than one session) deletes every session of the user except the current one. This device stays signed in. Called with no valid session, the endpoint returns 401 (`AuthGuard`), the page sends the shopper to login, and nothing is deleted.
12. AC12: After any sign-in (login, sign-up or password change) the user has at most 10 sessions. When an 11th is created, the least recently seen one is deleted in the same transaction, and the new sign-in always succeeds.
13. AC13: `GET /cron/cleanup-sessions` on the API project with `Authorization: Bearer <CRON_SECRET>` deletes sessions with `expiresAt < now` or `createdAt` older than 90 days, and `AuthAttempt` rows older than 24 hours (the longest throttle window is 60 minutes, sign-up per IP). It returns 200 with the deleted counts. A missing or wrong header, or an unset `CRON_SECRET`, returns 401 and deletes nothing. The comparison is constant-time. The API project's `vercel.json` schedules it daily (`0 3 * * *`), which works on Hobby (once a day, imprecise time) and Pro.
14. AC14: `CRON_SECRET` is in the API's `.env.example` as a placeholder, lives only on the API project, is never a `NEXT_PUBLIC_` variable, and is in the secrets lists in `architecture.md` and `auth-security.md`. Passwords, tokens, cookies, session hashes and raw request bodies never appear in logs, API responses or error messages.
15. AC15: `/account/security` responses carry `Cache-Control` with `private` and `no-store`, and both forms submit under the CSP (both come from security-headers; this spec adds no header code).
16. AC16: Playwright passes in CI against a real Postgres. It signs the same user in on two browser contexts A and B; A's devices list shows 2 rows; A signs out "other devices" and B's next navigation lands on login. Then it signs B in again, changes the password in A, and checks that B is logged out, A is still signed in, the old password fails at login and the new one works.

## Technical Approach

- **Paths:** this spec is built after `api-foundation`, so web files live under `apps/web/`. In this spec and its tasks, `src/...` means `apps/web/src/...`.

Since 2026-10-13 the backend is a separate NestJS API (`apps/api`), reached from the browser through the same-origin `/api` rewrite and from Server Components at `API_URL` (`../../../../architecture.md`). Everything that touches the database, tokens or hashes below lives in the API; the web app only renders and posts.

- **Data (wiring edit to the API's `prisma/schema.prisma`):** add `publicId String @unique @default(dbgenerated("gen_random_uuid()::text"))` to `Session`. Use `prisma migrate dev --name session_public_id`. The DB-side default backfills existing rows and keeps inserts from the previous deploy working (expand → contract: a client-side `@default(cuid())` would break a Vercel rollback). `publicId` is the only session identifier sent to the browser.
- **Auth module edits (signup-login's, in `apps/api/src/auth/`, not claimed):**
  - Session service:
    - `createSession(token, userId, meta, tx?)` enforces the cap: after the insert, it deletes the user's sessions beyond the 10 most recently seen, in one transaction (AC12).
    - `validateSessionToken` also sets `lastSeenAt = now` when it's older than 1h, merged with the renewal update (AC9).
    - New: `listSessions(userId)` returns `{ publicId, userAgent, createdAt, lastSeenAt }` with no id and no IP. `revokeSessionByPublicId(userId, publicId)` does `deleteMany({ where: { publicId, userId } })` and returns the count. `invalidateOtherSessions(userId, keepId)`. `deleteExpiredSessions(now)`.
    - Helpers take an optional Prisma `tx` so change password can compose them.
  - Throttle service: `checkPasswordChangeThrottle(userId)`, `recordPasswordChangeFailure(userId)` and `clearPasswordChangeFailures(userId)` on the key `pwchange:<userId>`, reusing the per-account limits (AC5). `pruneAuthAttempts(olderThan)`.
  - Password service is unchanged: change password calls the existing `hashPassword` / `verifyPassword`.
- **Shared (`packages/shared/src/account-security/`):** `changePasswordSchema`, used by the web form and the API.
- **API module `apps/api/src/account-security/`** (every endpoint behind the `AuthGuard`, user ID only from the guard):
  - `POST /account/password`: throttle check, `safeParse`, load `passwordHash`, `verifyPassword(current)`. On failure, record the failure and return the AC4 error (400 with per-field errors). On success, one `prisma.$transaction`: update `passwordHash` + `pepperVersion`, delete all of the user's sessions, `createSession(newToken)`. Then set the new session cookie on the response (only the API sets cookies), clear the throttle, and return `{ ok: true }`.
  - `POST /account/sessions/revoke` (`{ publicId }`): Zod-parse, refuse the current session's `publicId`, `revokeSessionByPublicId`. A count of 0 → 404 (not 403; never trust client IDs).
  - `POST /account/sessions/revoke-others`: `invalidateOtherSessions(user.id, currentSession.id)`, both from the guard. With no session the guard returns 401 and nothing runs.
  - `GET /account/sessions`: `listSessions` plus which `publicId` is the current one.
- **Web feature module `src/features/account-security/`:**
  - `device-label.ts` is a small in-house UA → "Browser on OS" parser (Chrome/Safari/Firefox/Edge × macOS/Windows/iOS/Android/Linux, else "Unknown device"). No new dependency.
  - UI: `ChangePasswordForm.tsx` (client: posts to `/api/account/password`, shows per-field errors, Zod on blur, `router.refresh()` on success), `DeviceList.tsx` (Server Component, a no-JS `<form method="post">` per row to `/api/account/sessions/revoke`, current row marked), `SignOutOthersButton.tsx`. For no-JS form posts the API answers with a 303 back to `/account/security`.
- **Page:** `src/app/account/security/page.tsx` (Server Component): `requireUser("/account/security")`, then `GET /account/sessions` at `API_URL` with the cookie forwarded.
- **Cron:** a `GET /cron/cleanup-sessions` controller in `apps/api/src/cron/`, because Vercel Cron sends a GET with `Authorization: Bearer $CRON_SECRET`. If `CRON_SECRET` is unset, fail closed with 401. Compare with `crypto.timingSafeEqual` (after a length check). Call `deleteExpiredSessions` + `pruneAuthAttempts(24h)` and return the counts. Never log headers.
  - This is a documented exception to "GET never changes state": it isn't cookie-authenticated, so it has no CSRF surface. It is not under the `/api` browser rewrite path's `AuthGuard`; it has its own Bearer check.
  - Crons run only on production deployments. Previews rely on lazy deletion on lookup.
  - Wiring edits: add `"crons": [{ "path": "/cron/cleanup-sessions", "schedule": "0 3 * * *" }]` to the API project's `vercel.json`, and add `CRON_SECRET=` to the API's `.env.example`. `CRON_SECRET` is set in the API project's Vercel production env (a long random value).
- **Docs (wiring edits):** add the `/account/security` route to `architecture.md`, plus a Gotcha on the cron exception (`CRON_SECRET` is already in the secrets lists since 2026-10-13). In `auth-security.md`, add a line saying cron endpoints authenticate with the Bearer secret.
- **Order of `auth-security.md` edits:** three changes touch this standard. (1) The in-house session rules from PR #10 are already merged on `develop` (rewritten for the NestJS API on 2026-10-13). (2) This spec's T21 adds the cron rule. (3) auth-event-logging's T22 adds the auth-event rules. Make them in that order: build T21 on top of `develop`, and auth-event-logging's T22 goes on top of T21. Each one appends to its own section and doesn't rewrite the others.
- **Entry point:** a temporary "Security" link on protected-routes' `/account` placeholder. account-wishlist's `account-profile` replaces it with a real link.
- **Tests:** API unit tests for the session helpers (cap eviction order, lastSeenAt hourly rule, revoke scoped to the user, invalidateOthers, deleteExpired), the throttle keys, the account-security endpoints (wrong current password, throttle, the success path rotating sessions, a foreign `publicId` → 404) and the cron controller (401 cases, deletes); Vitest for the schema and device-label. Playwright `e2e/session-management.spec.ts` covers AC16.

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

- [global/auth-security](../../../../../../standards/global/auth-security.md): the `AuthGuard` on every endpoint and `requireUser()` on the page, user ID only from the session, a foreign `publicId` → 404, a new token on password change, POST-only changes, only `apps/api/src/auth/` touches tokens and hashes, `CRON_SECRET` handling, no secrets in logs.
- [global/tech-stack](../../../../../../standards/global/tech-stack.md): NestJS API endpoints + shared Zod on client and server, the web never touches the database, a Bearer-authenticated cron endpoint, an expand → contract migration, Vitest + Playwright.
- [global/git-workflow](../../../../../../standards/global/git-workflow.md): branch off `develop`, PR to `develop`, `feat(accounts-auth): …` commits.

## Changelog

| Date | Author | Type | Change | Ref |
|---|---|---|---|---|
| 2026-10-11 | david-schwartzman | created | Initial shaping | — |
| 2026-10-12 | david-schwartzman | revised | PR review: `revokeOtherSessionsAction` calls `requireUser()` first (AC11 no-session case); explicit order of `auth-security.md` edits; 375px viewport check in e2e; security-plan sections copied into the repo | PR #15 |
| 2026-10-12 | david-schwartzman | revised | PR review: AC13 retention reason now cites the 60-minute sign-up-per-IP window (signup-login AC14) | PR #19 |
| 2026-10-13 | david-schwartzman | change | Backend moved to a separate NestJS API: actions become `apps/api/src/account-security/` endpoints behind the `AuthGuard`, auth module edits land in `apps/api/src/auth/`, schema moves to `packages/shared`, cron becomes the API's `GET /cron/cleanup-sessions`; AC3, AC10, AC11, AC13, AC14, Technical Approach, Standards Applied and Covers updated; open tasks reworded — tech-lead decision for a clear frontend / backend split | softwareos/products/stride/architecture.md |
| 2026-10-13 | david-schwartzman | revised | PR review: Covers uses `apps/web/src/...` for web files, with a Paths note in the Technical Approach; references.md describes `/api` forms and `POST /account/sessions/revoke` instead of Server Action patterns | https://github.com/david-schwartzman/Stride/pull/21 |
| 2026-10-15 | david-schwartzman | change | `standards.md` (global/auth-security copy): a missing or different `Origin` gets 401, not 403 — tech lead decision: both gatekeeper checks answer 401 | ../../../../../../standards/global/auth-security.md |
| 2026-10-15 | david-schwartzman | revised | Covers: the e2e entry gets the `apps/web/` prefix like the other web paths (the e2e folder moved with the web app in api-foundation) — api-foundation review | — |
