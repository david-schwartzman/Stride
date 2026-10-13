# Architecture

## Components

- **Monorepo, two apps + one shared package** (npm workspaces), both on Vercel, one Neon PostgreSQL database. Decided 2026-10-13 (tech lead): a clear frontend / backend split with the backend as its own NestJS service
  - **Web — `apps/web`:** the Next.js frontend. Pages, layout and UI only. Never imports Prisma, never holds a database or auth secret
  - **API — `apps/api`:** the NestJS backend. The only code that touches the database (Prisma), password hashes, session tokens and business rules. Modules: auth, session, catalog, cart, order, wishlist, account
  - **Shared — `packages/shared`:** Zod schemas and the request/response types both apps use
- **One origin:** the browser only ever talks to the web app's domain. Next rewrites `/api/*` to the API project, so browser calls, cookies and CSP all stay same-origin. Server Components call the API server-to-server at `API_URL` (server-only env var on the web project)
- **Routes:** `/` · `/catalog` · `/product/[slug]` · `/cart` · `/checkout` · `/checkout/confirmation/[orderId]` · `/login` · `/signup` · `/account` · `/account/orders/[orderId]` · `/wishlist`
- **UI layer:** Server Components render pages, reading from the API; small Client Components handle interaction and send writes to `/api/*`
- **API endpoints (Nest controllers):** cart, wishlist, checkout, profile and auth mutations, plus the reads pages need. Input validated with the shared Zod schemas
- **Auth module (`apps/api/src/auth/`, in-house, no auth library):** the only code that touches tokens, cookies and password hashes
  - Sessions: a random 256-bit opaque token in the `__Host-stride_session` cookie (HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 30 days), set and cleared by the API through the same-origin `/api` rewrite. The `Session` row's id is `sha256(token)`; the raw token is never stored. 30-day sliding expiry, 90-day absolute cap. Revoking = deleting the row. One row per device.
  - Passwords: Argon2id (19 MiB, t=2, p=1) with a per-user salt and a server-side pepper (`PASSWORD_PEPPER`), via `@node-rs/argon2`
  - Brute force: failed logins are recorded in `AuthAttempt` and throttled per account and per IP
  - A Nest `AuthGuard` (validates the cookie's session) protects every endpoint that needs a user; `GET /auth/me` returns the current user or 401
- **Web session helpers:** `getCurrentSession()` (React `cache()`) calls `GET /auth/me` with the incoming cookie forwarded; `requireUser()` (in `src/features/session/require-user.ts`, built on it) redirects to `/login` on 401. They decide what a page shows — authorization itself is the API's `AuthGuard`
- **Proxy / middleware (web):** checks only that a session cookie is present (no API call, no database) and redirects signed-out visitors from `/checkout`, `/account` and `/wishlist` to `/login`; re-sends the cookie's Max-Age on GET for sliding renewal. Page routes only — not an authorization layer
- **Data layer:** Prisma client in one shared module inside `apps/api`; migrations live in `apps/api/prisma/`
- **Database models:** User, Session, AuthAttempt, Address, Category, Product, ProductVariant (size + stock), Cart, CartItem, WishlistItem, Order, OrderItem

## Data Flow

- **Reads:** browser → Next.js page → Server Component fetches `API_URL` (session cookie forwarded) → Nest → Prisma → JSON → HTML with products. Endpoints with private data run the `AuthGuard`: one indexed `Session` ⋈ `User` lookup per request; renews `expiresAt` when fewer than 15 days remain
- **Writes:** user action → client form `POST /api/*` (same origin, rewritten to Nest) → Origin check → `AuthGuard` → validate (shared Zod) → write via Prisma → JSON → the page calls `router.refresh()`
- **Login / sign-up:** `POST /api/auth/login|signup` → throttle check → verify password (Argon2id) → new token → insert `Session` → merge guest cart → API sets the cookie → web redirects to a safe relative path
- **Logout:** `POST /api/auth/logout` → delete the `Session` row → API clears the cookie
- **Guest cart:** an HttpOnly, HMAC-signed (`GUEST_CART_SECRET`, API-only) cookie of `{variantId, qty}` only — no prices, about 50 lines max, Zod-parsed on read — merged into the DB cart in one transaction on login

## Environments

- **Local dev** — `apps/web` and `apps/api` run side by side; the API uses a Neon dev branch
- **Preview** — a Vercel preview per PR for each project; the web preview's `API_URL` / rewrite points at the API preview from the same commit, and the API preview gets its own Neon branch
- **Production** — two Vercel projects (web, API) on one domain via the `/api` rewrite
- Secrets have a different value in each environment and live on the API project only

## Gotchas

- Greenfield: no code yet — follow the specs and standards. (The app-foundation and signup-login code predates the 2026-10-13 split and still lives in one Next app; candidate specs `api-foundation` and `auth-api-migration` move it.)
- `apps/web` never imports Prisma, `@node-rs/argon2` or a secret — if a page needs data, add an API endpoint
- Keep the API behind the same-origin `/api` rewrite. Calling the API on its own domain from the browser breaks the `__Host-` cookie (no `Domain` allowed) and would need CORS
- Client IP crosses the rewrite: the API must read the client IP from a trusted forwarded header, not the connecting address (verify on a preview before relying on it for throttling or logging)
- Prices stored as integer cents, never floats
- OrderItem stores a price snapshot so old orders don't change when prices change
- Stock is reduced at order placement inside a database transaction; never allow negative stock
- The web proxy only guards page routes, and only checks that a cookie exists. Every API endpoint that changes data runs the `AuthGuard` itself and takes the user ID from the session — never trust a `userId` (or order/address ID ownership) sent from the client. Return 404, not 403, for objects the user doesn't own. Guest cart endpoints are the exception: they act only on the cart cookie
- Never store the raw session token server-side — only `sha256(token)`. Always create a **new** token at login, sign-up and password change (session fixation)
- Logout and every other state change is a POST (or DELETE) to `/api/*`, never a GET link; the API checks the `Origin` header on every state-changing request
- Throttle counters live in Postgres (`AuthAttempt`), not in memory: serverless instances don't share memory
- Only the API creates or deletes the session cookie; Server Components forward it but can't set one. The web proxy only re-sends its Max-Age on GET (sliding renewal)
- The `__Host-` prefix needs `Secure`; Safari may reject it on `http://localhost`, so dev uses the plain name `stride_session`
- Losing `PASSWORD_PEPPER` loses every password: back it up in a password manager; rotate it via `User.pepperVersion`, re-hashing on login
- Payment is mock only: never store or log card numbers
- Never log passwords, tokens, cookies or full request bodies from auth endpoints
- Run `prisma generate` / `prisma migrate` (in `apps/api`) after any schema change
- Secrets (`DATABASE_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET`, `CRON_SECRET`) live only in the API project's env vars, never in `NEXT_PUBLIC_` variables; never commit `.env`. `API_URL` is the web's only backend setting and is server-only
- Server-render by default; add `"use client"` only where interaction requires it
