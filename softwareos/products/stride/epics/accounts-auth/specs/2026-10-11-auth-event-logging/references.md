# References for Auth Event Logging

## Related Specs

_None._ The pre-flight coverage search (cross-epic) found no overlaps. This spec makes wiring edits to these prerequisite specs' files, but it doesn't claim them:

- **[Related]** [2026-10-08-app-foundation](../2026-10-08-app-foundation/spec.md) owns `prisma/schema.prisma`. This spec adds the `AuthEventType` enum, the `AuthEvent` model and the `User.authEvents` back-relation (T2). It claims only its own migration folder.
- **[Related]** [2026-10-08-signup-login](../2026-10-08-signup-login/spec.md) shipped the auth behaviour; the auth module and endpoints (`apps/api/src/auth/`) belong to [2026-10-13-auth-api-migration](../2026-10-13-auth-api-migration/spec.md), which moved them out of `src/lib/auth/**` and `src/features/auth/**`. This spec makes `createSession` return `publicId` and the invalidate helpers return counts (T17), and records events from `POST /auth/signup`, `POST /auth/login` and `POST /auth/logout` (T18). The module lives in `src/lib/auth-events/` instead of `src/lib/auth/`, because it never touches tokens or hashes (auth-security standard).
- **[Related]** [2026-10-11-session-management](../2026-10-11-session-management/spec.md) owns `apps/api/src/account-security/**`, `apps/api/src/cron/**` and adds `Session.publicId`. This spec records events from the change-password and revoke actions (T19) and adds the 90-day `AuthEvent` prune to the cron (T20). It must merge first.

## Similar Implementations

No application code exists yet (`src/` not scaffolded).

### Sibling specs

- **Location:** `../2026-10-08-signup-login/spec.md`, `../2026-10-11-session-management/spec.md`
- **Relevance:** they define the actions that emit events, `throttle.ts`, the shared `getClientIp()` helper (`src/lib/request-ip.ts` today, the API's `apps/api/src/common/request-ip.ts` after the move), the cleanup cron and `Session.publicId`.
- **Key patterns:** signup-login AC11/AC12 (no secrets in logs, form state or the DB; `Session.id` is `sha256(token)`); session-management AC8 (only `publicId` leaves the server), AC13 (cron auth and counts), AC14 (no secrets in logs).

### Product architecture and standards

- **Location:** `softwareos/standards/global/auth-security.md` ("Secrets and logs"), `softwareos/products/stride/architecture.md` (Gotchas)
- **Relevance:** never log passwords, tokens, cookies, reset links, raw form data or card numbers. `Session.id` is the token hash, so it is never logged or stored elsewhere; use `publicId`.

### Stride Auth & Session Security Plan

- **Location:** [../../security-plan-excerpts.md](../../security-plan-excerpts.md), § "Logging and audit trail" (rated "should"), copied from the private artifact https://claude.ai/artifact/QL1DDEEN6QERM6GsZP4a8h
- **Relevance:** the event list (signup, login success and failure, logout, logout-all, password change, session revoked; reset events deferred with password reset), the fields (user ID, IP, user agent, time) and the never-log list.

### Vercel `waitUntil()` (replaces Next.js `after()` since the 2026-10-13 move to NestJS)

- **Location:** `@vercel/functions`, Vercel docs, "waitUntil"
- **Relevance:** schedules the `AuthEvent` DB write after the API's response without Vercel's runtime dropping it. Read request headers before scheduling.

### Vercel runtime log retention

- **Location:** Vercel docs, "Runtime Logs" (retention per plan)
- **Relevance:** runtime log retention is short and depends on the plan, so confirm it for yours. That is why events also go to the `AuthEvent` table, and why a log drain is a later option.

### OWASP Logging Cheat Sheet

- **Location:** https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- **Relevance:** which auth events to record, when/where/who/what fields, data to never log (session IDs, passwords, secrets), and sanitising against log injection (the AC6 control-character strip).

## Planner assumptions

- The IP comes only from `getClientIp()`, never the leftmost `x-forwarded-for`, which the client controls. Before the 2026-10-13 move that meant Vercel's `x-real-ip`. Now the request crosses the web's `/api` rewrite into the API project, so the API sees the rewrite hop. Decided in the PR #21 review: the web proxy forwards the client IP as `x-stride-client-ip` with the `x-stride-proxy-secret` header, and the API reads it only after checking the secret (`architecture.md`, Trusted proxy headers). AC6 follows it.
- The AC10 e2e test reads `AuthEvent` rows through a test-only Prisma client on the CI `DATABASE_URL` (the Postgres service container signup-login adds).
- The `password_change` count comes from the in-transaction session delete. If `changePasswordAction` uses `invalidateAllSessions`, that helper must return a count (T17).
