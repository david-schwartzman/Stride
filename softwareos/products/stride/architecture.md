# Architecture

## Components

- **Single Next.js app** deployed on Vercel, talking to one Neon PostgreSQL database through Prisma
- **Routes:** `/` · `/catalog` · `/product/[slug]` · `/cart` · `/checkout` · `/checkout/confirmation/[orderId]` · `/login` · `/signup` · `/account` · `/account/orders/[orderId]` · `/wishlist`
- **UI layer:** Server Components render pages; small Client Components handle interaction
- **Server Actions:** cart, wishlist, checkout, profile and auth mutations
- **Auth.js:** sessions; middleware protects `/checkout`, `/account` and `/wishlist` (redirect to `/login`)
- **Data layer:** Prisma client in one shared module
- **Database models:** User, Address, Category, Product, ProductVariant (size + stock), Cart, CartItem, WishlistItem, Order, OrderItem

## Data Flow

- **Reads:** browser → Next.js page (server reads via Prisma) → HTML with products
- **Writes:** user action → Server Action → validate (Zod) → write via Prisma → revalidate page
- **Guest cart:** lives in a cookie and merges into the DB cart on login

## Environments

- **Local dev** — Neon dev branch
- **Preview** — Vercel preview deployment per PR
- **Production** — Vercel

## Gotchas

- Greenfield: no code yet — follow the specs and standards
- Prices stored as integer cents, never floats
- OrderItem stores a price snapshot so old orders don't change when prices change
- Stock is reduced at order placement inside a database transaction; never allow negative stock
- Payment is mock only: never store or log card numbers
- Run `prisma generate` / `prisma migrate` after any schema change
- Secrets (`DATABASE_URL`, `AUTH_SECRET`) live only in env vars; never commit `.env`
- Server-render by default; add `"use client"` only where interaction requires it
