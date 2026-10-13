# Tasks — Auth Event Logging

> Epic: accounts-auth
> Spec: 2026-10-11-auth-event-logging
> Branch: feat/accounts-auth/auth-event-logging

## Prerequisites

- [ ] T1 Confirm that signup-login (apps/api/src/auth/** (after auth-api-migration), User/Session/AuthAttempt) and session-management (`Session.publicId`, apps/api/src/account-security/, the API cron controller (apps/api/src/cron/)) are merged into this branch's base, and that their Vitest and Playwright suites pass. Every wiring edit below depends on those files. If either is unmerged, stop and rebase. Do not stub their code here.

## Data

- [ ] T2 Add `enum AuthEventType { signup signup_failure login_success login_failure logout session_revoked logout_others password_change password_change_failure }` and `model AuthEvent { id String @id @default(cuid()); type AuthEventType; userId String?; user User? @relation(fields: [userId], references: [id], onDelete: SetNull); sessionPublicId String?; reason String?; count Int?; ipAddress String?; userAgent String?; createdAt DateTime @default(now()); @@index([userId, createdAt]); @@index([ipAddress, createdAt]); @@index([createdAt]) }` to prisma/schema.prisma (app-foundation file, wiring edit), plus the `authEvents AuthEvent[]` back-relation on `User`. Generate prisma/migrations/<ts>_auth_event/ with `prisma migrate dev --name auth_event`. Check that the SQL is additive only: a new enum, a new table, three indexes, an FK with `ON DELETE SET NULL`, and no changes to existing tables. A rollback to the previous deploy must stay safe (AC9).

## Tests first (TDD)

- [ ] T3 Write failing Vitest cases in apps/api/src/auth-events/request-meta.test.ts (build a fake Nest request with headers):
  - `getRequestMeta(req)` returns the IP from the API's `getClientIp(req)`: the validated `x-stride-client-ip` on a request that passed the proxy-secret check, and null when it's missing or invalid.
  - A spoofed `x-forwarded-for` or `x-real-ip` alone gives a null IP.
  - `user-agent` has control characters stripped and is truncated to 512 characters. Test with exactly 512, 513 and a multi-KB value.
  - A missing user agent gives null (AC6).
  - (testing skill)
- [ ] T4 Write failing Vitest cases in apps/api/src/auth-events/record.test.ts (mock `prisma.authEvent.create`, `waitUntil` from @vercel/functions, `getRequestMeta`, and spy on `console.log`/`console.error`):
  - `await recordAuthEvent(...)` writes exactly one single-line stdout JSON `{"evt":"auth","type",…}` before the `waitUntil` callback runs, and the line has no `ipAddress` and no `userAgent` (AC2, AC7).
  - It calls `prisma.authEvent.create` once inside the `waitUntil` callback. The row has only the allowlisted columns for that type (`userId`, `sessionPublicId`, `reason`, `count`, `ipAddress`, `userAgent`) plus `createdAt`, and that `createdAt` equals the stdout line's (AC1, AC2, AC5).
  - Throttled events: with a matching throttled event in the last 15 minutes (`findFirst` mocked to return one), neither a row nor a stdout line is written. With none, both are written inside the `waitUntil` callback (AC11).
  - Unknown extra properties passed at runtime (`password`, `token`, `email`, `metadata`) are dropped from both the row and the stdout line (AC5).
  - A rejected `create` logs `{"evt":"auth_event_write_failed","type"}` with no error object or message carrying data. It does not throw, and the stdout line was still emitted (AC7).
  - A rejecting `getRequestMeta` still resolves without rejecting (AC7).
  - Each `reason` outside the type's allowed set fails a `// @ts-expect-error` type assertion (AC1, AC5).
  - (testing skill)
- [ ] T5 Write failing Vitest cases in apps/api/src/auth-events/prune.test.ts. `pruneAuthEvents(olderThan)` deletes only rows with `createdAt < olderThan` and returns the deleted count. A row exactly at the cutoff is kept. Rows with a null `userId` are pruned too (AC8). (testing skill)
- [ ] T6 Extend the API auth controller tests in apps/api/src/auth/ (signup-login file, wiring edit), with `recordAuthEvent` mocked:
  - `POST /auth/signup` records `signup` with `userId` + the new `sessionPublicId` on success.
  - `POST /auth/signup` records `signup_failure` / `email_taken` on P2002 and `signup_failure` / `throttled` when throttled.
  - An invalid form records nothing (AC1).
  - `POST /auth/login` records `login_success` with `userId` + the new `sessionPublicId` (AC1, AC3).
  - `POST /auth/login` records `login_failure` / `bad_password` with `userId` (AC4).
  - `login_failure` / `unknown_email` and `login_failure` / `throttled` have no `userId`, and the typed email appears in no argument (AC4).
  - A validation failure records nothing (AC1).
  - `POST /auth/logout` records `logout` with the ended session's `publicId` + `userId`, read before `invalidateSession` (AC3).
  - With no session, `POST /auth/logout` records nothing.
  - The recorder is awaited before the response is sent, and a rejecting recorder mock does not change any endpoint's status or body (AC7).
  - (testing skill)
- [ ] T7 Extend the account-security endpoint tests in apps/api/src/account-security/ (session-management file, wiring edit), with `recordAuthEvent` mocked:
  - `POST /account/password` success records `password_change` with `userId`, the new session's `publicId` and `count` = the number of sessions deleted (AC1, AC3).
  - A wrong current password records `password_change_failure` / `wrong_current_password`.
  - Throttled records `password_change_failure` / `throttled`.
  - A validation failure or a rolled-back transaction records nothing.
  - `POST /account/sessions/revoke` records `session_revoked` with the revoked `publicId` only when the count is 1, and nothing on `notFound()` or when the current `publicId` is refused (AC1, AC3).
  - `POST /account/sessions/revoke-others` records `logout_others` with `count` from `deleteMany` (AC1).
  - (testing skill)
- [ ] T8 Extend the API session service tests in apps/api/src/auth/ (signup-login file, wiring edit). `createSession` returns the new session's `publicId`. `invalidateOtherSessions` returns the deleted count. Existing callers still compile and pass (AC3). (testing skill)
- [ ] T9 Extend the cron controller tests in apps/api/src/cron/ (session-management file, wiring edit). An authorised GET calls `pruneAuthEvents` with `now − 90 days` and returns `{ sessions, authAttempts, authEvents }`. The 401 cases call no prune (AC8). (testing skill)
- [ ] T10 Write a failing AC5 secret-leak Vitest in apps/api/src/auth-events/no-secrets.test.ts:
  - Use a fixed known password, known session token, its `sha256` (`Session.id`), the cookie header value, test `PASSWORD_PEPPER` and `CRON_SECRET`, and a raw form email.
  - Drive every recording action through each success and failure path: signup, signup taken, signup throttled, login ok, bad password, unknown email, login throttled, logout, revoke, revoke others, change password ok, wrong current, change throttled. Use the real `recordAuthEvent` with `waitUntil` executed inline.
  - Capture every stdout/stderr line and every `authEvent.create` payload.
  - Assert that none of those strings appear as a substring of any captured line or row (AC5).
  - (testing skill)
- [ ] T11 Write failing Playwright e2e/auth-events.spec.ts against real Postgres, with `extraHTTPHeaders` setting `x-real-ip: 203.0.113.7` (the web proxy forwards it to the API as `x-stride-client-ip` with the proxy secret):
  - Steps: sign up a fresh email, log out, log in with a wrong password, then log in correctly.
  - Query `AuthEvent` for the user, ordered by `createdAt`, and expect exactly `signup`, `logout`, `login_failure` (`bad_password`), `login_success`.
  - Each row has `ipAddress` `203.0.113.7` and a non-null `userAgent`. The `logout` `sessionPublicId` equals the `signup` one. No row has a `sessionPublicId` that matches any `Session.id`.
  - Poll briefly for the rows, because the write runs in the `waitUntil` callback (AC10).
  - (testing skill)

## Auth events module

- [ ] T12 Add apps/api/src/auth-events/types.ts:
  - `AuthEventInput` is a discriminated union on `type` with per-type fields: `signup_failure.reason: "email_taken" | "throttled"`; `login_failure` as a union of `{ reason: "bad_password"; userId }` and `{ reason: "unknown_email" | "throttled" }` with no `userId`; `password_change_failure.reason: "wrong_current_password" | "throttled"`; `logout_others` / `password_change` have `count: number`; `sessionPublicId` only on `signup`, `login_success`, `logout`, `session_revoked`, `password_change`.
  - Add a per-type allowlist of keys used by the recorder.
  - No free-form or metadata field (AC1, AC4, AC5).
- [ ] T13 Add apps/api/src/auth-events/request-meta.ts. `getRequestMeta(req)` takes the Nest request (no `next/headers`) and gets the IP from `getClientIp(req)` (apps/api/src/common/request-ip.ts, api-foundation); no second IP parser. It strips control characters from `user-agent` (`/[\u0000-\u001F\u007F]/g`) and truncates it to 512 characters (AC6). T3 goes green.
- [ ] T14 Add apps/api/src/auth-events/record.ts (no `import "server-only"`: it throws outside React Server Components and would crash the API module on load). `async recordAuthEvent(req, input: AuthEventInput): Promise<void>`, where `req` is the Nest request:
  - `getRequestMeta(req)` and capture `createdAt = new Date()` once.
  - Build the row from the type's allowlist only.
  - Non-throttled: immediately `console.log(JSON.stringify({ evt: "auth", type, reason, count, userId, sessionPublicId, createdAt }))` on one line (no IP/UA), then schedule `waitUntil((async () => { try { await prisma.authEvent.create({ data: { ...row, createdAt } }) } catch { console.error(JSON.stringify({ evt: "auth_event_write_failed", type })) } })`.
  - Throttled: in the `waitUntil` callback, `findFirst` a matching throttled event (same type, same IP or `userId` key, last 15 minutes); if none, write the stdout line and the row as above. When the key is a null IP, skip the `findFirst` and always write (AC11).
  - Wrap the whole body in try/catch so it never rejects (AC1, AC2, AC5, AC7, AC11). T4 goes green.
- [ ] T15 Add apps/api/src/auth-events/prune.ts. `pruneAuthEvents(olderThan: Date)` runs `prisma.authEvent.deleteMany({ where: { createdAt: { lt: olderThan } } })` and returns the count (AC8). T5 goes green.
- [ ] T16 Add apps/api/src/auth-events/index.ts, exporting only `recordAuthEvent`, `pruneAuthEvents` and the `AuthEventInput` type. Callers must not import `prisma.authEvent` directly.

## Auth module (sibling files, wiring edits)

- [ ] T17 Edit the API session service in apps/api/src/auth/ (signup-login file). `createSession` returns `{ publicId }` alongside its current return value. `invalidateOtherSessions` returns the `deleteMany` count. If `POST /account/password` uses `invalidateAllSessions`, that returns its count too. Update the existing callers in apps/api/src/auth/ and apps/api/src/account-security/ so they still type-check (AC3). T8 goes green.
- [ ] T18 Edit the API auth controller/service in apps/api/src/auth/ (signup-login file):
  - `POST /auth/signup`: `signup_failure` / `throttled` after the throttle check; `signup_failure` / `email_taken` on P2002; `signup` with `userId` + `publicId` after `createSession`.
  - `POST /auth/login`: `login_failure` / `throttled`; `unknown_email` on the dummy-hash branch, with no `userId` and no email; `bad_password` with `userId`; `login_success` with `userId` + `publicId`.
  - `POST /auth/logout`: call `getCurrentSession()` before `invalidateSession` and record `logout` with `userId` + `publicId`.
  - Record nothing on a `safeParse` failure.
  - Each call is `await`ed before the response is sent (AC1, AC3, AC4, AC7). T6 goes green.
- [ ] T19 Edit the account-security endpoints in apps/api/src/account-security/ (session-management file):
  - `POST /account/password`: `password_change_failure` / `throttled`; `wrong_current_password`; `password_change` with `userId`, the new `publicId` and `count` from the transaction's session `deleteMany`, recorded only after the commit.
  - `POST /account/sessions/revoke`: `session_revoked` with the parsed `publicId` when the count is 1, before responding.
  - `POST /account/sessions/revoke-others`: `logout_others` with the returned count.
  - `await` each call (before the response is sent). Also covers AC7.
  - T7 goes green.

## Cron (sibling file, wiring edit)

- [ ] T20 Edit the `GET /cron/cleanup-sessions` controller in apps/api/src/cron/ (session-management file). After the auth check, call `pruneAuthEvents(new Date(now - 90 * 24h))` and add `authEvents` to the 200 JSON response. The 401 path is unchanged and still never logs headers (AC8). T9 goes green.

## Docs (wiring edits)

- [ ] T21 Edit softwareos/products/stride/architecture.md:
  - Add the `AuthEvent` model and its 90-day retention, pruned by the nightly cron.
  - Add the logging line: one `{"evt":"auth",…}` stdout JSON per event, plus `{"evt":"auth_event_write_failed","type"}` on DB failure.
  - Add a Gotcha: "Record auth events only via `recordAuthEvent` from apps/api/src/auth-events; never write `AuthEvent` or log auth activity directly."
- [ ] T22 Edit softwareos/standards/global/auth-security.md, "Secrets and logs". Order: this goes on top of session-management's T21 (`CRON_SECRET` rules), which goes on top of PR #10's rules already on `develop`. Append; don't rewrite other sections:
  - Add the same rule that auth events go only through `recordAuthEvent`, with no free-form metadata.
  - Add "log `Session.publicId`, never `Session.id` (the token hash)".
  - Add that the typed email is never logged on a failed login.
  - Add that the client IP comes only from `getClientIp()` (apps/api/src/common/request-ip.ts), and stdout auth lines carry no IP or user agent.

## Verification

- [ ] T23 Confirm that T10 (secret leak) and T11 (e2e) now pass. Run the full Vitest suite and Playwright e2e/auth-events.spec.ts green in CI against Postgres. Include the existing signup-login, session-management and protected-routes suites, because they now go through the changed `createSession` / `invalidateOtherSessions` signatures (testing skill)
- [ ] T24 (optional) Security review of the recorder allowlist, the request-meta parsing and the action wiring diff (security-reviewer agent)
- [ ] T25 Run QA against acceptance criteria (qa skill)
