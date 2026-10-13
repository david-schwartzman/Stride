# Auth & Session Security Plan — excerpts

The sections of the Stride Auth & Session Security Plan (Oct 2026) that accounts-auth specs build from, copied here so the specs don't depend on a private link. The full plan is the private artifact https://claude.ai/artifact/QL1DDEEN6QERM6GsZP4a8h. If the two disagree, the specs win; update this file through the spec that changes the decision.

## Second device

- A new device runs the normal sign-in flow and gets its **own** token and session row. Existing devices' tokens are untouched and stay valid.
- Account → "Your devices" lists the sessions ("Chrome on macOS · last active 2 h ago · this device") from `userAgent` and `lastSeenAt`. Each has a Sign out button, plus "Sign out of all other devices".
- Optional cap: at most 10 sessions per user. When an 11th is created, delete the oldest.
- Optional later: a "New sign-in" email once an email provider exists.

## Expiry & renewal

- New session: `expiresAt = now + 30 days`, cookie `Max-Age` 30 days.
- When fewer than 15 days remain, extend `expiresAt` to now + 30 days and re-send the cookie (from the web proxy on GET, or an API response; Server Components can't set cookies).
- Absolute limit: never extend beyond `createdAt + 90 days`.
- `lastSeenAt` is updated at most once an hour so reads don't turn into writes.
- An expired session is treated as missing (row deleted, cookie cleared). A nightly Vercel Cron job on the API project deletes `WHERE expiresAt < now()`.

## Change password (signed in)

1. The form asks for the **current** password and the new one (protects an unlocked laptop).
2. `requireUser()`, verify the current password, throttle failures like login.
3. Hash the new password and update `User.passwordHash`.
4. **Delete every session for the user**, including the current one, then create a fresh session for this device.

## Revocation

Revoking = deleting the session row. The next request with that token finds nothing and is treated as logged out.

| Trigger | What to delete |
|---|---|
| Log out | This session |
| "Sign out" on a device | That session (verify it belongs to the user) |
| "Sign out everywhere else" | All of the user's sessions except the current one |
| Password change or reset | All sessions, then issue a new one for this device |
| Account deleted | All sessions (cascade delete) |
| Admin / suspected compromise | All of that user's sessions |
| Expired | Lazily on lookup, plus the nightly cron |

## Brute force cleanup

- Failed logins insert `AuthAttempt` rows keyed `email:x` and `ip:y`. Success clears the account counter. A nightly cron deletes rows older than a day.

## Logging and audit trail (rated "should")

- Log these events: signup, login success, login failure, logout, logout-all, password change, reset requested and reset completed, and session revoked.
- Include the user ID, IP, user agent and time.
- **Never log** passwords, tokens, full cookies, reset links or full card numbers.
- Error pages show a generic message. Stack traces go to logs only.
