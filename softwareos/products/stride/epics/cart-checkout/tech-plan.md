# Cart & Checkout — Tech Plan

> Epic: epic.md · Product: ../../mission.md

## Approach

The cart has two backends behind one interface: a signed cookie for guests and Cart/CartItem rows for logged-in users, merged on login via the hook from accounts-auth. Cart mutations are Server Actions with Zod validation that revalidate the cart page and header count. Checkout is a protected page with a Client Component form. Its "place order" Server Action re-reads prices and stock on the server, then in one Prisma transaction creates Order + OrderItems (price snapshot), saves the Address and decrements ProductVariant stock with a guard against going below zero. The mock payment only validates card format and discards it. Totals and shipping are calculated in one shared server-side function.

## Architecture Impact

- New models + migration: Cart, CartItem, Address, Order, OrderItem (OrderItem stores unit price in cents and size snapshot).
- Routes `/cart`, `/checkout`, `/checkout/confirmation/[orderId]`.
- Guest-cart cookie + merge-on-login logic.
- Wires up the add-to-cart button on product detail and the cart count in the header.
- Uses ProductVariant stock from catalog-search. No new external services.

## Risks & Unknowns

- Race conditions on stock: two orders for the last unit. Use a conditional update (stock >= qty) inside the transaction.
- Guest cart merge rules: what if the same variant is in both carts, or the merged quantity exceeds stock? Decide the rule (sum, capped at stock).
- Merge-on-login hook dependency: the accounts-auth epic's plan doesn't define a post-login hook yet. Agree on where the merge runs (Auth.js callback vs. login Server Action) with accounts-auth before `guest-cart-merge`.
- Cookie size/tampering: store only variant IDs + quantities, sign them, and always re-price on the server.
- Price changes between cart and checkout: the server price at order time wins, and it's snapshotted.
- Card data leaking into logs or error reports: strip it before anything is logged.
- Spike: none, but test the stock transaction early.

## Candidate Specs

- `cart` — add to cart, /cart page, quantity/remove, totals + shipping rule, empty state (logged-in DB cart)
- `guest-cart-merge` — cookie cart for guests and merge into DB cart on login
- `checkout-order` — protected checkout, address + mock payment validation, order transaction with stock reduction
- `order-confirmation` — confirmation page with order number and summary, owner-only access; Playwright e2e landing → confirmation
