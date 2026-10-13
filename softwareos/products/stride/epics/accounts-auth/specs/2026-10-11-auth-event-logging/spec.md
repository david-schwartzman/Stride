# Auth Event Logging

> Epic: ../../epic.md
> Status: shaped
> Branch: feat/accounts-auth/auth-event-logging
> Covers: src/lib/auth-events/**, prisma/migrations/*_auth_event/**, e2e/auth-events.spec.ts

## Overview

A spec of Accounts & Auth from the tech plan's candidate list (tech-plan.md:46). Hardening, not required for launch. It serves the brief's goal "A secure session" (product-brief.md:10) and its rule that plain passwords are never stored or logged. It adds no new success criterion. The Auth & Session Security Plan rates it "should".

Every security-relevant auth action records one structured event, in two places: an `AuthEvent` row in Postgres (durable, queryable, pruned after 90 days by the nightly cron), with the user ID, IP, user agent and time; and a short JSON line on stdout (Vercel runtime logs) with no IP and no user agent. It never includes passwords, tokens, cookies, session hashes or raw form data.

Builds on `signup-login` (sign-up/login/logout actions, `src/lib/auth/`) and `session-management` (change-password and revoke actions, `Session.publicId`, the cleanup cron). Both must be merged first. Changes to their files are wiring edits that this spec doesn't claim, as are changes to `prisma/schema.prisma`, `architecture.md` and `auth-security.md`.

## Goals & User Stories

- As the store, when a shopper reports "someone got into my account", I can see their sign-ins, failures, revokes and password changes, with IP, device and time, for the last 90 days.
- As the store, I can spot credential stuffing: many failed logins from one IP, across many accounts.
- As a shopper, my password, session cookie and other secrets never end up in any log or audit table.
- As a developer, I record an event with one call that can't break or slow down the auth action that called it.

## Acceptance Criteria

1. AC1: These events are recorded, each with `type`, `createdAt`, `ipAddress`, `userAgent` and, where known, `userId` and `sessionPublicId`: `signup` · `signup_failure` (reason `email_taken` | `throttled`) · `login_success` · `login_failure` (reason `bad_password` | `unknown_email` | `throttled`) · `logout` · `session_revoked` (one device, its `publicId`) · `logout_others` (with the number of sessions revoked) · `password_change` (with the number of sessions revoked) · `password_change_failure` (reason `wrong_current_password` | `throttled`). Validation failures (a bad email format, a short password) are not recorded.
2. AC2: Each event is written as one `AuthEvent` row **and** one single-line JSON log to stdout (`{"evt":"auth",...}`). The stdout line has only `type`, `reason`, `count`, `userId`, `sessionPublicId` and `createdAt`: **no IP and no user agent**, because stdout logs aren't covered by the 90-day prune. `createdAt` is captured once in code and the same value goes to both the row and the line.
3. AC3: `login_success`, `signup` and `password_change` record the `publicId` of the new session. `logout` and `session_revoked` record the `publicId` of the session that ended. `Session.id` (the token hash) is never recorded.
4. AC4: `login_failure` with `unknown_email` and `throttled` stores no `userId` and **never the email that was typed**. `bad_password` stores the account's `userId`.
5. AC5: The recorder accepts only an allowlisted, typed set of fields. It has no free-form metadata. Passwords, session tokens, `sha256(token)`, cookies, the pepper, `CRON_SECRET` and raw form data are not in any event row or stdout line. A test drives every action with a known password and token and checks the captured logs and rows.
6. AC6: The IP comes from signup-login's shared `getClientIp()` (`src/lib/request-ip.ts`: Vercel's `x-real-ip`, validated, else null; never `x-forwarded-for`), so throttling and event logging always see the same IP. The user agent is cut to 512 characters and control characters are removed (stops log injection).
7. AC7: Recording never changes how an auth action behaves or responds: the DB write runs in `after()` (next/server), after the response. If the write fails, it logs `{"evt":"auth_event_write_failed","type":...}` (no event fields) and the action still succeeds. The stdout line is emitted even when the DB write fails. Callers `await recordAuthEvent(...)`, which resolves quickly (it only awaits the request headers) and never rejects.
8. AC8: The nightly `GET /api/cron/cleanup-sessions` also deletes `AuthEvent` rows older than 90 days and returns `authEvents` in its counts.
9. AC9: The `AuthEvent` migration only adds a table, which is safe for expand → contract. `userId` is a nullable FK with `onDelete: SetNull`, so events outlive a deleted user. Their IP and user agent stay until the 90-day prune (see Retention). Indexes are `[userId, createdAt]`, `[ipAddress, createdAt]` and `[createdAt]`.
10. AC10: Playwright in CI against a real Postgres, with `x-real-ip: 203.0.113.7` set through `extraHTTPHeaders` (there's no Vercel edge locally): sign up → log out → wrong-password login → login. It reads the user's `AuthEvent` rows and expects `signup`, `logout`, `login_failure(bad_password)` and `login_success`, in order, each with IP `203.0.113.7` and a user agent.
11. AC11: Throttled events (`signup_failure`, `login_failure` and `password_change_failure` with reason `throttled`) are recorded at most once per type and key per 15-minute window. The key is the IP for sign-up and login, and the `userId` for password change. When the IP is null (`getClientIp` found none), the dedupe is skipped and the event is written. Inside `after()`, an indexed `findFirst` looks for a matching throttled event in the last 15 minutes. If one exists, neither the row nor the stdout line is written. A burst of parallel requests may write a few duplicates, but the number of writes depends on the window, not on how many attempts an attacker makes.

## Technical Approach

- **Data (wiring edit to `prisma/schema.prisma`):** `enum AuthEventType { signup signup_failure login_success login_failure logout session_revoked logout_others password_change password_change_failure }` and `model AuthEvent { id String @id @default(cuid()); type AuthEventType; userId String?; user User? @relation(fields: [userId], references: [id], onDelete: SetNull); sessionPublicId String?; reason String?; count Int?; ipAddress String?; userAgent String?; createdAt DateTime @default(now()); @@index([userId, createdAt]); @@index([ipAddress, createdAt]); @@index([createdAt]) }`, plus the `authEvents AuthEvent[]` back-relation on `User`. Migration via `prisma migrate dev --name auth_event`.
- **Module `src/lib/auth-events/`** (outside `src/lib/auth/`, because it never touches tokens or hashes):
  - `types.ts`: a discriminated union `AuthEventInput` per type, so a reason/count only fits the types that use it.
  - `request-meta.ts`: `async getRequestMeta()` awaits `headers()` (async in Next 15+, and sync access is gone in Next 16, which app-foundation installs). It returns `{ ip: getClientIp(h), userAgent }` per AC6.
  - `record.ts`: `async recordAuthEvent(input): Promise<void>`. It awaits the request meta, captures `createdAt = new Date()` once, and builds the row from allowlisted fields only. For non-throttled events it writes the stdout line at once (AC2 fields only), then schedules `prisma.authEvent.create({ data: { ...row, createdAt } })` in `after()` with try/catch per AC7. For throttled events, the AC11 dedupe check, the stdout line and the create all run inside `after()`. It never rejects. Callers `await` it **before** `redirect()`, because `redirect()` throws.
  - `prune.ts`: `pruneAuthEvents(olderThan: Date)` returns the deleted count.
- **Wiring edits (not claimed):**
  - signup-login `src/features/auth/actions.ts`: signup/login success, failure and throttled paths. `signOutAction` reads the current session before `invalidateSession` so it can record `userId` + `publicId`.
  - `src/lib/auth/session.ts`: `createSession` also returns the new `publicId` (one-line change, no token exposure).
  - session-management `src/features/account-security/actions.ts`: change password (success, wrong current, throttled), `revokeSessionAction`, `revokeOtherSessionsAction` (it uses the `deleteMany` count).
  - `src/app/api/cron/cleanup-sessions/route.ts`: call `pruneAuthEvents(now - 90d)` and add it to the counts.
  - `architecture.md`: the `AuthEvent` model, a logging line, and the Gotcha "record auth events only via `recordAuthEvent`". `auth-security.md` under "Secrets and logs": the same rule, plus "log `publicId`, never `Session.id`".
- **Retention (decision):** IP and user agent are personal data, so they live in one place only: the `AuthEvent` table, pruned after 90 days (the same as the absolute session cap). The stdout line leaves them out (AC2). It keeps only the type, IDs and time, which are enough to correlate with the table and are under Vercel's own runtime-log retention, which depends on the plan. When a user is deleted, `onDelete: SetNull` keeps their events for the security trail, and their IP and user agent are removed by the 90-day prune at the latest. v1 has no account deletion. The spec that adds it decides whether to null IP and user agent right away.
- **Tests:** Vitest for `request-meta` (uses `getClientIp`, UA truncation and control chars), `record` (allowlist, stdout shape without IP/UA, one shared `createdAt`, throttled dedupe, a DB failure is swallowed and logged), `prune`, each action emitting the right event (mocked recorder), the AC5 secret-leak test, and the cron count. Playwright `e2e/auth-events.spec.ts` per AC10.

## Out of Scope

- An admin or support UI for browsing events, and a shopper-facing "recent activity" page.
- Alerting, anomaly detection, log drains and external log services (architecture: no new external services).
- Events for session-cap evictions, expiry and cron deletions (housekeeping, not security actions).
- Reset requested and reset completed events (no password reset in v1).
- Logging non-auth events (orders, cart).

## Standards Applied

- [global/auth-security](../../../../../../standards/global/auth-security.md): no secrets in logs, only `src/lib/auth/` touches tokens and hashes, user ID only from the session.
- [global/tech-stack](../../../../../../standards/global/tech-stack.md): expand → contract migration, Vitest + Playwright.
- [global/git-workflow](../../../../../../standards/global/git-workflow.md): branch off `develop`, PR to `develop`, `feat(accounts-auth): …` commits.

## Changelog

| Date | Author | Type | Change | Ref |
|---|---|---|---|---|
| 2026-10-11 | david-schwartzman | created | Initial shaping | — |
| 2026-10-12 | david-schwartzman | revised | PR review: async `getRequestMeta`/`recordAuthEvent` (awaited before `redirect()`); stdout line without IP/UA and recorded retention decision; throttled events deduped per window (AC11); IP from signup-login's shared `getClientIp` (`x-real-ip`); one `createdAt` for row and line; e2e sets `x-real-ip` | PR #16 |
| 2026-10-12 | david-schwartzman | revised | PR review: AC11 and T14 say a null IP skips the throttled-event dedupe | PR #19 |
