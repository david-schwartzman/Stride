# Cart & Checkout — Tech Plan

> Epic: epic.md · Product: ../../mission.md

## Approach

The cart has two backends behind one interface: a signed cookie for guests and Cart/CartItem rows for logged-in users, merged on login via the hook from accounts-auth. Cart mutations are NestJS API endpoints (`apps/api` cart module) with shared Zod validation; the web's client components POST to `/api/cart/*` and call `router.refresh()` so the cart page and header count update. Checkout is a protected page with a Client Component form. Its "place order" call (`POST /api/orders`) re-reads prices and stock in the API, then in one Prisma transaction creates Order + OrderItems (price snapshot), saves the Address and decrements ProductVariant stock with a guard against going below zero. The mock payment only validates card format and discards it. Totals and shipping are calculated in one shared function in the API.

## Architecture Impact

- New API modules (cart, order) and models + migration in `apps/api`: Cart, CartItem, Address, Order, OrderItem (OrderItem stores unit price in cents and size snapshot).
- Routes `/cart`, `/checkout`, `/checkout/confirmation/[orderId]`.
- Guest-cart cookie + merge-on-login logic.
- Wires up the add-to-cart button on product detail and the cart count in the header.
- Uses ProductVariant stock from catalog-search. No new external services.

## Risks & Unknowns

- Race conditions on stock: two orders for the last unit. Use a conditional update (stock >= qty) inside the transaction.
- Guest cart merge rules: what if the same variant is in both carts, or the merged quantity exceeds stock? Decide the rule (sum, capped at stock).
- Merge-on-login hook: resolved. accounts-auth's signup-login defines `onSignedIn(userId)` (today `src/features/auth/hooks.ts`, called from the login and sign-up Server Actions; after `auth-api-migration` it is a hook in the API auth service called by `POST /auth/login|signup`). `guest-cart-merge` implements it and does the whole merge in one transaction.
- Cookie size/tampering: an HttpOnly cookie of `{variantId, qty}` only (no prices or names), HMAC-signed with `GUEST_CART_SECRET`, Zod-parsed on read (drop bad or unknown entries), capped at about 50 lines; always re-price on the server.
- Price changes between cart and checkout: the server price at order time wins, and it's snapshotted.
- Card data leaking into logs or error reports: strip it before anything is logged.
- Depends on accounts-auth `api-foundation` (the NestJS API, monorepo and `/api` rewrite) — the backend moved to a separate NestJS service on 2026-10-13 (`../../architecture.md`).
- Spike: none, but test the stock transaction early.

## Candidate Specs

- `cart` — add to cart, /cart page, quantity/remove, totals + shipping rule, empty state (logged-in DB cart)
- `guest-cart-merge` — cookie cart for guests and merge into DB cart on login
- `checkout-order` — protected checkout, address + mock payment validation, order transaction with stock reduction
- `order-confirmation` — confirmation page with order number and summary, owner-only access; Playwright e2e landing → confirmation
