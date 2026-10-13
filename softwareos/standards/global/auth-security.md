# Auth Security

Rules for any code that knows who the user is. The design behind them is in `softwareos/products/stride/architecture.md` (Auth module).

## Who the user is

- Only the API's auth module (`apps/api/src/auth/`) touches session tokens, password hashes and creates or deletes the session cookie. Other API code uses its `AuthGuard` and current-user decorator; the web app uses `getCurrentSession()` (calls `GET /auth/me`) or `requireUser()` (`src/features/session/require-user.ts`).
- Every API endpoint that changes data or returns private data runs the `AuthGuard`. That is the authorization layer. The web's `requireUser()` and proxy/middleware only decide what to render or where to redirect; they are not authorization.
- The user ID always comes from the session. Never accept a `userId` from the client.
- Scope every private query by the session user (`where: { id, userId: user.id }`). An object the user doesn't own returns 404, not 403.

## Sessions and passwords

- Create a **new** session token at login, sign-up and password change. Never reuse a token that arrived with the request.
- Store only `sha256(token)` server-side; the raw token lives only in the HttpOnly `__Host-stride_session` cookie (never `localStorage`).
- Hash passwords with Argon2id + pepper via the API auth module's password service. Never hash on the client or in `apps/web`.

## Requests

- GET never changes state. Every change, including logout, is a POST (or DELETE) to `/api/*`.
- Redirect targets taken from input (`next`, `callbackUrl`) must be same-origin relative paths; otherwise fall back to `/`.
- The API checks the `Origin` header on every state-changing request (one global Nest guard/middleware), and serves the browser only through the same-origin `/api` rewrite — no CORS.

## Secrets and logs

- Secrets (`DATABASE_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET`, `CRON_SECRET`) live in the API project's env vars with a different value per environment — never on the web project and never in a `NEXT_PUBLIC_` variable.
- Never log passwords, session tokens, cookies, reset links or raw request bodies from auth endpoints. Users see generic errors; details go to logs only.
