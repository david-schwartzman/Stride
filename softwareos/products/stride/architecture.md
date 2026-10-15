# Architecture

## Components

- **Monorepo, two apps + one shared package** (npm workspaces), both on Vercel, one Neon PostgreSQL database. Decided 2026-10-13 (tech lead): a clear frontend / backend split with the backend as its own NestJS service
  - **Web — `apps/web`:** the Next.js frontend. Pages, layout and UI only. Never imports Prisma, never holds a database or auth secret
  - **API — `apps/api`:** the NestJS backend. The only code that touches the database (Prisma), password hashes, session tokens and business rules. Modules: auth, session, catalog, cart, order, wishlist, account
  - **Shared — `packages/shared`:** Zod schemas and the request/response types both apps use
- **One origin:** the browser only ever talks to the web app's domain, so browser calls, cookies and CSP all stay same-origin. The web proxy (Next middleware, not a `next.config` rewrite, because it has to add headers) rewrites `/api/*` to the API at `API_URL`. It strips the `/api` prefix (`/api/auth/login` → `API_URL/auth/login`) and passes the whole `Cookie` header through (session and guest cart). Server Components call the API server-to-server at `API_URL` (server-only env var on the web project)
- **Trusted proxy headers:** the API is publicly reachable (Server Components need `API_URL`), so it trusts nothing a direct caller could send. On every call, from the proxy rewrite and from Server Components, the web sets `x-stride-proxy-secret` (`WEB_PROXY_SECRET`), `x-stride-client-ip` (the shopper's IP from Vercel's `x-real-ip` at the web edge) and `x-stride-forwarded-host` (the host the browser used). It overwrites any client-sent copies. One global Nest middleware compares the secret in constant time and rejects any request without a valid one with 401 (`/cron/*` is the exception; it has its own Bearer check). Only after that check does the API read the client IP (validated, else null) and the forwarded host
- **Routes:** `/` · `/catalog` · `/product/[slug]` · `/cart` · `/checkout` · `/checkout/confirmation/[orderId]` · `/login` · `/signup` · `/account` · `/account/orders/[orderId]` · `/wishlist`
- **UI layer:** Server Components render pages, reading from the API; small Client Components handle interaction and send writes to `/api/*`
- **API endpoints (Nest controllers):** cart, wishlist, checkout, profile and auth mutations, plus the reads pages need. Input validated with the shared Zod schemas
- **Auth module (`apps/api/src/auth/`, in-house, no auth library):** the only code that touches tokens, cookies and password hashes
  - Sessions: a random 256-bit opaque token in the `__Host-stride_session` cookie (HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 30 days), set and cleared by the API through the same-origin `/api` rewrite. The `Session` row's id is `sha256(token)`; the raw token is never stored. 30-day sliding expiry, 90-day absolute cap. Revoking = deleting the row. One row per device.
  - Passwords: Argon2id (19 MiB, t=2, p=1) with a per-user salt and a server-side pepper (`PASSWORD_PEPPER`), via `@node-rs/argon2`
  - Brute force: failed logins are recorded in `AuthAttempt` and throttled per account and per IP
  - A Nest `AuthGuard` (validates the cookie's session) protects every endpoint that needs a user; `GET /auth/me` returns the current user or 401
- **Web session helpers:** `getCurrentSession()` (React `cache()`) calls `GET /auth/me` with the incoming cookie forwarded; `requireUser()` (in `src/features/session/require-user.ts`, built on it) redirects to `/login` on 401. They decide what a page shows — authorization itself is the API's `AuthGuard`
- **Proxy / middleware (web):** two jobs. (1) It rewrites `/api/*` to the API with the trusted proxy headers (created in `api-foundation`). (2) On page routes it checks only that a session cookie is present (no API call, no database), redirects signed-out visitors from `/checkout`, `/account` and `/wishlist` to `/login`, and re-sends the cookie's Max-Age on GET for sliding renewal (added in `protected-routes`). It is not an authorization layer
- **Data layer:** Prisma client in one shared module inside `apps/api`; migrations live in `apps/api/prisma/`
- **Database models:** User, Session, AuthAttempt, Address, Category, Product, ProductVariant (size + stock), Cart, CartItem, WishlistItem, Order, OrderItem

## Data Flow

- **Reads:** browser → Next.js page → Server Component fetches `API_URL` (whole `Cookie` header and the trusted proxy headers forwarded) → Nest → Prisma → JSON → HTML with products. Endpoints with private data run the `AuthGuard`: one indexed `Session` ⋈ `User` lookup per request; renews `expiresAt` when fewer than 15 days remain
- **Writes:** user action → client form `POST /api/*` (same origin, rewritten to Nest by the web proxy) → proxy-secret check → Origin check (`Origin` must equal `https://` + the trusted `x-stride-forwarded-host` (`http://` in local dev only); a missing `Origin` is rejected; 403 otherwise) → `AuthGuard` → validate (shared Zod) → write via Prisma → JSON → the page calls `router.refresh()`
- **Login / sign-up:** `POST /api/auth/login|signup` → throttle check → verify password (Argon2id) → new token → insert `Session` → merge guest cart → API sets the cookie → web redirects to a safe relative path
- **Logout:** `POST /api/auth/logout` → delete the `Session` row → API clears the cookie
- **Guest cart:** an HttpOnly, HMAC-signed (`GUEST_CART_SECRET`, API-only) cookie of `{variantId, qty}` only — no prices, about 50 lines max, Zod-parsed on read — merged into the DB cart in one transaction on login

## Environments

- **Local dev** — `apps/web` and `apps/api` run side by side; the API uses a Neon dev branch
- **Preview** — a Vercel preview per PR for each project, and the API preview gets its own Neon branch. Goal: the web preview's `API_URL` points at the API preview from the same commit. `API_URL` is one static Preview env value, so the mechanism is still open and the `api-foundation` spike settles it (for example, the proxy derives the API preview's branch URL from `VERCEL_GIT_COMMIT_REF`, or Vercel Services puts both apps in one project). API previews sit behind Vercel Deployment Protection, so the web also sends `x-vercel-protection-bypass` (the API project's automation bypass secret, stored on the web project) on preview calls. A plain `next.config` rewrite can't add that header, which is another reason the proxy does the rewrite
- Until pairing works, a web preview may call the shared `develop` API preview. Preview checks of a change that spans both apps then happen after the API PR merges
- **Production** — two Vercel projects (web, API) on one domain via the proxy's `/api` rewrite
- **Deploy order:** the two projects don't deploy atomically. The API ships first, and every API change stays backward-compatible with the web deploy currently in production (add an endpoint or field, then switch the web over, then remove the old one in a later deploy). The web never calls an endpoint that isn't live in the API yet. An API rollback must keep working with the current web
- Secrets have a different value in each environment and live on the API project only

## Gotchas

- Since `auth-api-migration`, the web app reads no database URL or auth secret.
- Vercel env cleanup (human step): the web Vercel project may still hold `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER` and `GUEST_CART_SECRET` from before the 2026-10-13 split. Remove them from the web project once `auth-api-migration` is deployed.
- `apps/web` never imports Prisma, `@node-rs/argon2` or a secret — if a page needs data, add an API endpoint
- Keep the API behind the same-origin `/api` rewrite. Calling the API on its own domain from the browser breaks the `__Host-` cookie (no `Domain` allowed) and would need CORS
- Client IP crosses the rewrite. The API reads it only from `x-stride-client-ip` on a request with a valid `x-stride-proxy-secret` (see Trusted proxy headers), never from `x-forwarded-for`, `x-real-ip` or the connecting address: across the rewrite those are the web project's egress IP, which all shoppers share. When the IP is missing or invalid it is null, and per-IP throttles **fail open** (skip the per-IP check, keep the per-account one) rather than put everyone in one bucket. Verify on an `api-foundation` preview
- Prices stored as integer cents, never floats
- OrderItem stores a price snapshot so old orders don't change when prices change
- Stock is reduced at order placement inside a database transaction; never allow negative stock
- The web proxy only guards page routes, and only checks that a cookie exists. Every API endpoint that changes data runs the `AuthGuard` itself and takes the user ID from the session — never trust a `userId` (or order/address ID ownership) sent from the client. Return 404, not 403, for objects the user doesn't own. Guest cart endpoints are the exception: they act only on the cart cookie
- Never store the raw session token server-side — only `sha256(token)`. Always create a **new** token at login, sign-up and password change (session fixation)
- Logout and every other state change is a POST (or DELETE) to `/api/*`, never a GET link; the API checks the `Origin` header on every state-changing request
- Throttle counters live in Postgres (`AuthAttempt`), not in memory: serverless instances don't share memory
- Only the API creates or deletes the session cookie; Server Components forward it but can't set one. The one exception: the web proxy re-sends the existing cookie unchanged (same name, value and attributes, Max-Age 30 days) on GET for sliding renewal, only through `refreshSessionCookie` in `packages/shared/src/session-cookie.ts`
- The `__Host-` prefix needs `Secure`; Safari may reject it on `http://localhost`, so dev uses the plain name `stride_session`
- Losing `PASSWORD_PEPPER` loses every password: back it up in a password manager; rotate it via `User.pepperVersion`, re-hashing on login
- Payment is mock only: never store or log card numbers
- Never log passwords, tokens, cookies or full request bodies from auth endpoints
- Run `prisma generate` / `prisma migrate` (in `apps/api`) after any schema change
- Secrets (`DATABASE_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET`, `CRON_SECRET`) live only in the API project's env vars, never in `NEXT_PUBLIC_` variables; never commit `.env`. The web holds only server-only `API_URL`, `WEB_PROXY_SECRET` (the same value on both projects, a different value per environment) and, on Preview, the API's protection-bypass secret
- Server-render by default; add `"use client"` only where interaction requires it
