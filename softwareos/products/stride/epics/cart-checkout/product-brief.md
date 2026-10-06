# Cart & Checkout — Product Brief

> Epic: epic.md · Product: ../../mission.md

## Goals

Beginner runners who have found the right gear need a simple, trustworthy way to buy it. This epic delivers the core purchase:

- A cart that works for guests (saved in a cookie) and merges into the account cart on login.
- Checkout requires login and includes a validated shipping address, flat $5 shipping (free over $75), and mock payment (card format only; nothing is charged or stored).
- The order is saved and stock is reduced.
- A confirmation page shows the order number and summary.
- Landing to confirmed order in under 3 minutes.

## User Stories

- As a shopper, I can add a product in a chosen size to my cart from the product page.
- As a guest, my cart is kept in a cookie and merges into my account cart when I log in.
- As a shopper, I can change quantities (+/-), remove items, and see subtotal, shipping and total.
- As a shopper with an empty cart, I see an empty state with a link back to the catalog.
- As a logged-in shopper, I enter a shipping address with inline validation errors.
- As a shopper, I enter mock card details (format checked only) and place the order. Nothing is charged or stored.
- As a shopper, I see a confirmation page with order number and summary.
- As a shopper, I can't order more than what's in stock.

## Success Criteria

- Add-to-cart, quantity and remove work for guests (cookie) and logged-in users (DB). The guest cart merges on login without duplicate lines.
- Shipping is $5 under $75 and free at $75 or more. All money is in integer cents.
- Checkout requires login. Address and card-format validation errors show inline and match Figma.
- Placing an order creates Order + OrderItems with a price snapshot and reduces stock in one DB transaction. Stock never goes negative, and an out-of-stock line blocks the order with a clear message.
- Card numbers are never saved or logged.
- Confirmation page `/checkout/confirmation/[orderId]` is only viewable by its owner.
- Playwright: landing → add to cart → checkout → confirmation passes in CI, well under 3 minutes.

## Out of Scope

- Real payments (mock only in v1)
- Taxes
- Coupons / discounts
- Guest checkout (post-launch roadmap)
- Order confirmation emails (post-launch roadmap)
