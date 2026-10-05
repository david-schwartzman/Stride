# Account & Wishlist — Product Brief

> Epic: epic.md · Product: ../../mission.md

## Goals

Beginners often aren't ready to buy on the first visit and want to come back to products they liked, and buyers want to see what they ordered. This epic delivers:

- An account page with editable name and saved shipping address.
- An order history with each order's details.
- A wishlist with a heart toggle on cards and product pages, a wishlist page, move-to-cart and remove.

## User Stories

- As a logged-in shopper, I can see and edit my name and saved shipping address on /account.
- As a shopper, I see a list of my past orders and can open one at /account/orders/[orderId] to see items, sizes, prices and totals.
- As a shopper, I can tap a heart on any product card or product page to save or unsave it.
- As a logged-out shopper, tapping the heart sends me to login.
- As a shopper, I can view my wishlist, move an item to the cart (choosing a size) or remove it.
- As a shopper with no favorites or no orders, I see a helpful empty state.

## Success Criteria

- Profile and address edits are validated with Zod and persist. The saved address prefills checkout.
- Order history shows only the user's own orders, using the price snapshot (old orders don't change when prices change). Other users' order URLs are blocked.
- The heart toggle updates instantly and persists, with state correct on catalog, product detail and the wishlist page.
- Move-to-cart adds the right variant, and sold-out items are handled clearly.
- Empty wishlist and empty order history states match Figma.
- Playwright: favorite a product → wishlist → move to cart passes, and order history shows the order placed in the checkout test.

## Out of Scope

- Password reset
- Email change verification
- Reorder
- Returns / refunds
- Order tracking
- Wishlist sharing
- Recommendations
