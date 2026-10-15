# Auth Event Logging

> Epic: ../../epic.md
> Status: shaped
> Branch: feat/accounts-auth/auth-event-logging
> Covers: apps/api/src/auth-events/**, apps/api/prisma/migrations/*_auth_event/**, apps/web/e2e/auth-events.spec.ts

## Overview

A spec of Accounts & Auth from the tech plan's candidate list (tech-plan.md:46). Hardening, not required for launch. It serves the brief's goal "A secure session" (product-brief.md:10) and its rule that plain passwords are never stored or logged. It adds no new success criterion. The Auth & Session Security Plan rates it "should".

Every security-relevant auth action records one structured event, in two places: an `AuthEvent` row in Postgres (durable, queryable, pruned after 90 days by the nightly cron), with the user ID, IP, user agent and time; and a short JSON line on stdout (the API project's Vercel runtime logs) with no IP and no user agent. It never includes passwords, tokens, cookies, session hashes or raw form data.

Builds on `signup-login` (sign-up/login/logout endpoints and the auth module, in the NestJS API's `apps/api/src/auth/` once candidate `auth-api-migration` lands) and `session-management` (change-password and revoke endpoints, `Session.publicId`, the cleanup cron). Both must be merged first, and `api-foundation` before them (the backend moved to a separate NestJS API on 2026-10-13). Changes to their files are wiring edits that this spec doesn't claim, as are changes to the API's `prisma/schema.prisma`, `architecture.md` and `auth-security.md`.

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
6. AC6: The IP comes from the API's shared `getClientIp()` (`apps/api/src/common/request-ip.ts`), which reads `x-stride-client-ip` only on a request that passed `api-foundation`'s proxy-secret check (`x-stride-proxy-secret`), validated, else null. It never reads `x-forwarded-for`, `x-real-ip` or the connecting address, which across the rewrite is the web's shared egress IP (`architecture.md`, Trusted proxy headers). Throttling and event logging therefore always see the same IP. The user agent is cut to 512 characters and control characters are removed (stops log injection).
7. AC7: Recording never changes how an auth endpoint behaves or responds: the DB write runs after the response via `waitUntil` (`@vercel/functions`). If the write fails, it logs `{"evt":"auth_event_write_failed","type":...}` (no event fields) and the endpoint still succeeds. The stdout line is emitted even when the DB write fails. Callers `await recordAuthEvent(req, ...)`, which resolves quickly (it only reads the request headers) and never rejects.
8. AC8: The nightly `GET /cron/cleanup-sessions` (API project) also deletes `AuthEvent` rows older than 90 days and returns `authEvents` in its counts.
9. AC9: The `AuthEvent` migration only adds a table, which is safe for expand → contract. `userId` is a nullable FK with `onDelete: SetNull`, so events outlive a deleted user. Their IP and user agent stay until the 90-day prune (see Retention). Indexes are `[userId, createdAt]`, `[ipAddress, createdAt]` and `[createdAt]`.
10. AC10: Playwright in CI against a real Postgres, web and API running, with `x-real-ip: 203.0.113.7` set through `extraHTTPHeaders` (there's no Vercel edge locally, so the web proxy takes it as the client IP and forwards it to the API as `x-stride-client-ip` with the proxy secret): sign up → log out → wrong-password login → login. It reads the user's `AuthEvent` rows and expects `signup`, `logout`, `login_failure(bad_password)` and `login_success`, in order, each with IP `203.0.113.7` and a user agent.
11. AC11: Throttled events (`signup_failure`, `login_failure` and `password_change_failure` with reason `throttled`) are recorded at most once per type and key per 15-minute window. The key is the IP for sign-up and login, and the `userId` for password change. When the IP is null (`getClientIp` found none), the dedupe is skipped and the event is written. Inside the `waitUntil` callback, an indexed `findFirst` looks for a matching throttled event in the last 15 minutes. If one exists, neither the row nor the stdout line is written. A burst of parallel requests may write a few duplicates, but the number of writes depends on the window, not on how many attempts an attacker makes.

## Technical Approach

- **Data (wiring edit to the API's `prisma/schema.prisma`):** `enum AuthEventType { signup signup_failure login_success login_failure logout session_revoked logout_others password_change password_change_failure }` and `model AuthEvent { id String @id @default(cuid()); type AuthEventType; userId String?; user User? @relation(fields: [userId], references: [id], onDelete: SetNull); sessionPublicId String?; reason String?; count Int?; ipAddress String?; userAgent String?; createdAt DateTime @default(now()); @@index([userId, createdAt]); @@index([ipAddress, createdAt]); @@index([createdAt]) }`, plus the `authEvents AuthEvent[]` back-relation on `User`. Migration via `prisma migrate dev --name auth_event`.
- **API module `apps/api/src/auth-events/`** (outside the auth module, because it never touches tokens or hashes):
  - `types.ts`: a discriminated union `AuthEventInput` per type, so a reason/count only fits the types that use it.
  - `request-meta.ts`: `getRequestMeta(req)` reads the Nest request's headers and returns `{ ip: getClientIp(req), userAgent }` per AC6.
  - `record.ts`: `async recordAuthEvent(req, input): Promise<void>`. It reads the request meta, captures `createdAt = new Date()` once, and builds the row from allowlisted fields only. For non-throttled events it writes the stdout line at once (AC2 fields only), then schedules `prisma.authEvent.create({ data: { ...row, createdAt } })` with `waitUntil` (`@vercel/functions`) and try/catch per AC7. For throttled events, the AC11 dedupe check, the stdout line and the create all run inside the `waitUntil` callback. It never rejects. Callers `await` it before sending the response.
  - `prune.ts`: `pruneAuthEvents(olderThan: Date)` returns the deleted count.
- **Wiring edits (not claimed):**
  - signup-login's API auth endpoints (`apps/api/src/auth/`): signup/login success, failure and throttled paths. `POST /auth/logout` reads the current session before `invalidateSession` so it can record `userId` + `publicId`.
  - The API session service: `createSession` also returns the new `publicId` (one-line change, no token exposure).
  - session-management `apps/api/src/account-security/`: `POST /account/password` (success, wrong current, throttled), `POST /account/sessions/revoke`, `POST /account/sessions/revoke-others` (it uses the `deleteMany` count).
  - The API's `GET /cron/cleanup-sessions` controller (`apps/api/src/cron/`): call `pruneAuthEvents(now - 90d)` and add it to the counts.
  - `architecture.md`: the `AuthEvent` model, a logging line, and the Gotcha "record auth events only via `recordAuthEvent`". `auth-security.md` under "Secrets and logs": the same rule, plus "log `publicId`, never `Session.id`".
- **Retention (decision):** IP and user agent are personal data, so they live in one place only: the `AuthEvent` table, pruned after 90 days (the same as the absolute session cap). The stdout line leaves them out (AC2). It keeps only the type, IDs and time, which are enough to correlate with the table and are under the API project's Vercel runtime-log retention, which depends on the plan. When a user is deleted, `onDelete: SetNull` keeps their events for the security trail, and their IP and user agent are removed by the 90-day prune at the latest. v1 has no account deletion. The spec that adds it decides whether to null IP and user agent right away.
- **Tests:** API unit tests for `request-meta` (uses `getClientIp`, UA truncation and control chars), `record` (allowlist, stdout shape without IP/UA, one shared `createdAt`, throttled dedupe, a DB failure is swallowed and logged), `prune`, each endpoint emitting the right event (mocked recorder), the AC5 secret-leak test, and the cron count. Playwright `e2e/auth-events.spec.ts` per AC10.

## Out of Scope

- An admin or support UI for browsing events, and a shopper-facing "recent activity" page.
- Alerting, anomaly detection, log drains and external log services (architecture: no new external services).
- Events for session-cap evictions, expiry and cron deletions (housekeeping, not security actions).
- Reset requested and reset completed events (no password reset in v1).
- Logging non-auth events (orders, cart).

## Standards Applied

- [global/auth-security](../../../../../../standards/global/auth-security.md): no secrets in logs, only `apps/api/src/auth/` touches tokens and hashes, user ID only from the session.
- [global/tech-stack](../../../../../../standards/global/tech-stack.md): expand → contract migration, Vitest + Playwright.
- [global/git-workflow](../../../../../../standards/global/git-workflow.md): branch off `develop`, PR to `develop`, `feat(accounts-auth): …` commits.

## Changelog

| Date | Author | Type | Change | Ref |
|---|---|---|---|---|
| 2026-10-11 | david-schwartzman | created | Initial shaping | — |
| 2026-10-12 | david-schwartzman | revised | PR review: async `getRequestMeta`/`recordAuthEvent` (awaited before `redirect()`); stdout line without IP/UA and recorded retention decision; throttled events deduped per window (AC11); IP from signup-login's shared `getClientIp` (`x-real-ip`); one `createdAt` for row and line; e2e sets `x-real-ip` | PR #16 |
| 2026-10-12 | david-schwartzman | revised | PR review: AC11 and T14 say a null IP skips the throttled-event dedupe | PR #19 |
| 2026-10-13 | david-schwartzman | change | Backend moved to a separate NestJS API: recorder moves to `apps/api/src/auth-events/` with `waitUntil` (`@vercel/functions`) instead of `after()`; hooks into the API auth and account-security endpoints and cron; AC6 client IP forwarded across the `/api` rewrite (verified in `api-foundation`); AC7, AC8, AC10, AC11, Technical Approach, Standards Applied and Covers updated; open tasks reworded — tech-lead decision for a clear frontend / backend split | softwareos/products/stride/architecture.md |
| 2026-10-13 | david-schwartzman | revised | PR review: AC6 and AC10 name the client-IP trust model (`x-stride-client-ip` read only after the proxy-secret check); T13 and T14 take the Nest `req` (`getRequestMeta(req)`, `recordAuthEvent(req, input)`) instead of `next/headers`, and T14 drops `import "server-only"` (it throws outside React Server Components); T3, T11 and T17 match | https://github.com/david-schwartzman/Stride/pull/21 |
| 2026-10-15 | david-schwartzman | change | `standards.md` (global/auth-security copy): a missing or different `Origin` gets 401, not 403 — tech lead decision: both gatekeeper checks answer 401 | ../../../../../../standards/global/auth-security.md |
| 2026-10-15 | david-schwartzman | revised | Covers: the e2e entry gets the `apps/web/` prefix like the other web paths (the e2e folder moved with the web app in api-foundation); Overview: `api-foundation` is no longer a candidate — api-foundation review | — |
