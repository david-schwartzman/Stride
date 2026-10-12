# Architecture

## Components

- **Single Next.js app** deployed on Vercel, talking to one Neon PostgreSQL database through Prisma
- **Routes:** `/` · `/catalog` · `/product/[slug]` · `/cart` · `/checkout` · `/checkout/confirmation/[orderId]` · `/login` · `/signup` · `/account` · `/account/orders/[orderId]` · `/wishlist`
- **UI layer:** Server Components render pages; small Client Components handle interaction
- **Server Actions:** cart, wishlist, checkout, profile and auth mutations
- **Auth module (`src/lib/auth/`, in-house, no auth library):** the only code that touches tokens, cookies and password hashes
  - Sessions: a random 256-bit opaque token in the `__Host-stride_session` cookie (HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 30 days). The `Session` row's id is `sha256(token)`; the raw token is never stored. 30-day sliding expiry, 90-day absolute cap. Revoking = deleting the row. One row per device.
  - Passwords: Argon2id (19 MiB, t=2, p=1) with a per-user salt and a server-side pepper (`PASSWORD_PEPPER`), via `@node-rs/argon2`
  - Brute force: failed logins are recorded in `AuthAttempt` and throttled per account and per IP
  - `getCurrentSession()` (React `cache()`, in `src/lib/auth/current.ts`) and `requireUser()` (in `src/features/session/require-user.ts`, built on `getCurrentSession()`) are the only ways code learns who the user is
- **Proxy / middleware:** checks only that a session cookie is present (no database) and redirects signed-out visitors from `/checkout`, `/account` and `/wishlist` to `/login`; re-sends the cookie's Max-Age on GET for sliding renewal. Page routes only — not an authorization layer
- **Data layer:** Prisma client in one shared module
- **Database models:** User, Session, AuthAttempt, Address, Category, Product, ProductVariant (size + stock), Cart, CartItem, WishlistItem, Order, OrderItem

## Data Flow

- **Reads:** browser → Next.js page (server reads via Prisma) → HTML with products. Pages with private data call `getCurrentSession()`: one indexed `Session` ⋈ `User` lookup per request, cached; renews `expiresAt` when fewer than 15 days remain
- **Writes:** user action → Server Action (POST) → `requireUser()` → validate (Zod) → write via Prisma → revalidate page
- **Login / sign-up:** throttle check → verify password (Argon2id) → new token → insert `Session` → merge guest cart → set cookie → redirect to a safe relative path
- **Logout:** POST → delete the `Session` row → clear the cookie
- **Guest cart:** an HttpOnly, HMAC-signed (`GUEST_CART_SECRET`) cookie of `{variantId, qty}` only — no prices, about 50 lines max, Zod-parsed on read — merged into the DB cart in one transaction on login

## Environments

- **Local dev** — Neon dev branch
- **Preview** — Vercel preview deployment per PR
- **Production** — Vercel
- Secrets have a different value in each environment

## Gotchas

- Greenfield: no code yet — follow the specs and standards
- Prices stored as integer cents, never floats
- OrderItem stores a price snapshot so old orders don't change when prices change
- Stock is reduced at order placement inside a database transaction; never allow negative stock
- The proxy only guards page routes, and only checks that a cookie exists. Server Actions are POST endpoints callable from any page (e.g. the wishlist heart on public `/catalog`), so every mutating action calls `requireUser()` itself and takes the user ID from the session — never trust a `userId` (or order/address ID ownership) sent from the client. Return 404, not 403, for objects the user doesn't own. Guest cart actions are the exception: they act only on the cart cookie
- Never store the raw session token server-side — only `sha256(token)`. Always create a **new** token at login, sign-up and password change (session fixation)
- Logout and every other state change is a POST (Server Action), never a GET link
- Throttle counters live in Postgres (`AuthAttempt`), not in memory: serverless instances don't share memory
- Server Components can't set or delete cookies: cookie refresh happens in the proxy, cookie deletion in Server Actions
- The `__Host-` prefix needs `Secure`; Safari may reject it on `http://localhost`, so dev uses the plain name `stride_session`
- Losing `PASSWORD_PEPPER` loses every password: back it up in a password manager; rotate it via `User.pepperVersion`, re-hashing on login
- Payment is mock only: never store or log card numbers
- Never log passwords, tokens, cookies or full form data from auth actions
- Run `prisma generate` / `prisma migrate` after any schema change
- Secrets (`DATABASE_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET`) live only in env vars, never in `NEXT_PUBLIC_` variables; never commit `.env`
- Server-render by default; add `"use client"` only where interaction requires it
