# Auth Security

Rules for any code that knows who the user is. The design behind them is in `softwareos/products/stride/architecture.md` (Auth module).

## Who the user is

- Only `src/lib/auth/` touches session tokens, cookies and password hashes. Everything else calls `getCurrentSession()` (`src/lib/auth/current.ts`) or `requireUser()` (`src/features/session/require-user.ts`).
- Every mutating Server Action and every page or query that reads private data calls `requireUser()` first. The proxy/middleware is a redirect convenience, not authorization.
- The user ID always comes from the session. Never accept a `userId` from the client.
- Scope every private query by the session user (`where: { id, userId: user.id }`). An object the user doesn't own returns 404, not 403.

## Sessions and passwords

- Create a **new** session token at login, sign-up and password change. Never reuse a token that arrived with the request.
- Store only `sha256(token)` server-side; the raw token lives only in the HttpOnly `__Host-stride_session` cookie (never `localStorage`).
- Hash passwords with Argon2id + pepper via `src/lib/auth/password.ts`. Never hash on the client.

## Requests

- GET never changes state. Every change, including logout, is a POST (Server Action or form).
- Redirect targets taken from input (`next`, `callbackUrl`) must be same-origin relative paths; otherwise fall back to `/`.
- Plain Route Handlers that change data check the `Origin` header themselves.

## Secrets and logs

- Secrets (`DATABASE_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET`) live in env vars with a different value per environment, and never in a `NEXT_PUBLIC_` variable.
- Never log passwords, session tokens, cookies, reset links or raw form data from auth actions. Users see generic errors; details go to logs only.
