# References for Session Management

## Related Specs

_None._ The pre-flight coverage search (cross-epic) found no overlaps. These specs are prerequisites that this spec edits for wiring, but it doesn't claim their files:

- **[Related]** [2026-10-08-app-foundation](../2026-10-08-app-foundation/spec.md) owns `prisma/schema.prisma`, `vercel.json` and `.env.example`. This spec adds `Session.publicId` (T1), the `crons` entry and `CRON_SECRET=` (T18). It stays separate because app-foundation owns the config files as a whole; this spec claims only its own migration folder.
- **[Related]** [2026-10-08-signup-login](../2026-10-08-signup-login/spec.md) owns `src/lib/auth/**`. This spec extends `session.ts` (10-session cap, hourly `lastSeenAt`, list/revoke-by-`publicId`, cleanup helpers; T8) and `throttle.ts` (`pwchange:<userId>` key, `pruneAuthAttempts`; T9), and leaves `password.ts` unchanged. It stays separate because only `src/lib/auth/` may touch tokens and hashes (auth-security standard); the device and password-change features live in `src/features/account-security/`.
- **[Related]** [2026-10-11-protected-routes](../2026-10-11-protected-routes/spec.md) owns `requireUser()`, the `/account` prefix guard and the throwaway `src/app/account/page.tsx` placeholder. This spec adds a temporary "Security" link to that placeholder (T19). It stays separate because the guard and session header are protected-routes' concern.
- **[Related]** [2026-10-11-security-headers](../2026-10-11-security-headers/spec.md) (uncommitted at shaping time) gives `/account/security` `Cache-Control: private, no-store` via `isPrivatePath` (the `/account` prefix) and the CSP's `form-action 'self'`. This spec adds no header code and only checks the result (T22, AC15).

## Similar Implementations

No application code exists yet (`src/` not scaffolded).

### Sibling specs

- **Location:** `../2026-10-08-signup-login/spec.md`, `../2026-10-11-protected-routes/spec.md`
- **Relevance:** they define `session.ts`, `throttle.ts`, `getCurrentSession()`, `requireUser()` and the Server Action + form patterns this spec reuses.
- **Key patterns:** `useActionState` + `useFormStatus` forms with shared Zod schemas; per-field error return shape that never echoes passwords; throttle keys in `AuthAttempt`; a no-JS `<form action={…}>` button (protected-routes' `LogoutButton`) for the per-device Sign out.

### Product architecture and standards

- **Location:** `softwareos/products/stride/architecture.md` (Auth module, Gotchas), `softwareos/standards/global/auth-security.md`
- **Relevance:** Server Components can't set or delete cookies, so `changePasswordAction` sets the new cookie itself. Never trust client-sent IDs, and return 404 rather than 403 for objects the user doesn't own (`revokeSessionAction`). Create a new token on password change.

### Stride Auth & Session Security Plan

- **Location:** https://claude.ai/artifact/QL1DDEEN6QERM6GsZP4a8h
- **Relevance:** the "Second device", "Expiry & renewal", "Change password" flows and the revocation table. Sources for: `lastSeenAt` at most hourly, the optional 10-session cap (oldest evicted), the nightly Vercel Cron cleanup, and password change = current password + revoke all + new session.

### External guidance

- **Vercel Cron Jobs docs:** `crons` in `vercel.json`. Vercel sends `Authorization: Bearer $CRON_SECRET` when the env var is set. Crons run only on production deployments. The Hobby plan allows one run a day at an imprecise time, so the schedule is daily (`0 3 * * *`).
- **OWASP Session Management and Password Storage cheat sheets:** on a password change, require the current password, invalidate all sessions and issue a new session ID.

## Shaping decisions

- **`Session.publicId` uses a DB-generated default (`gen_random_uuid()::text`) instead of a Prisma `@default(cuid())`.** Prisma fills in `cuid()` in application code, so after a Vercel rollback, inserts from the previous deploy would fail the new NOT NULL column. The DB default backfills existing rows and keeps the migration expand → contract.
- **The session cap evicts the least recently seen session** rather than refusing the sign-in, so a shopper is never locked out.
- **`architecture.md` and `auth-security.md` are updated as implementation tasks** (T20, T21) on the spec branch, not during shaping.
