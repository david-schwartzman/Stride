# Account & Wishlist — Tech Plan

> Epic: epic.md · Product: ../../mission.md

## Approach

/account, /account/orders/[orderId] and /wishlist are server-rendered and protected by the existing middleware. They read through Prisma, scoped to the session user. Profile/address updates and wishlist add/remove/move-to-cart are Server Actions with Zod validation. The heart is a small Client Component with an optimistic toggle that calls a Server Action and redirects guests to login. Move-to-cart reuses the cart Server Action from cart-checkout. Order history reads Order/OrderItem snapshots, so it never recalculates prices.

## Architecture Impact

- New WishlistItem model + migration (user + product, unique pair).
- Routes `/account`, `/account/orders/[orderId]`, `/wishlist`.
- Uses the existing User, Address, Order, OrderItem and Cart from earlier epics.
- Adds the heart toggle to product cards and product detail (catalog-search components).
- No new services or infra.

## Risks & Unknowns

- Wishlist stores product vs. variant: mission says the heart is per product, so move-to-cart needs a size picker step. Confirm the UX in Figma.
- Showing heart state on the SSR catalog grid means a per-user query on a page that's otherwise the same for everyone. Keep it to one query of the user's wishlisted IDs.
- Authorization: every order/address query must filter by session user ID (IDOR risk).
- Depends on cart-checkout being done for move-to-cart and real order history.

## Candidate Specs

- `account-profile` — /account with editable name + saved shipping address (prefills checkout)
- `order-history` — order list + order detail page from snapshots, owner-only
- `wishlist` — WishlistItem model, heart toggle on cards/product page, /wishlist page with move-to-cart, remove, empty state
