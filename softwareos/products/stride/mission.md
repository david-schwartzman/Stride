# Product Mission

> Customer: softwareos/customer/overview.md

## Problem

Big retailers overwhelm beginner runners with thousands of options. Someone getting ready for their first 5K/10K doesn't know which shoes, apparel or gear they actually need, so they struggle to buy with confidence.

## Target Users

Beginner runners preparing for their first 5K/10K who want simple, trustworthy guidance on shoes, apparel and gear.

## Solution

A small, hand-picked catalog organized by the kind of running you do, with plain-language guidance tags ("good for your first 5K") so beginners can buy with confidence — and fast: from landing to a confirmed order in under 3 minutes.

## Core Shopping Flow

landing → catalog → product detail → cart → checkout → confirmation

## v1 Scope — IN

All prices in USD.

1. **Home** — hero, featured products, shop-by-category and shop-by-run-type entry points.
2. **Catalog** — grid of all products; search by name; filter by category (Shoes / Apparel / Gear), run type (Road / Trail / Race day), gender (Men / Women / Unisex) and price range; sort by price; empty state for "no results".
3. **Product detail** — images, name, price, description, beginner tag, size selector (shoes US 6–13 incl. half sizes; apparel XS–XL; gear one size), stock per size. Sold-out sizes are shown but disabled; a fully sold-out product stays browsable with "Out of stock". Add to cart; add to wishlist.
4. **Cart** — line items with size, quantity +/-, remove, subtotal, shipping, total; empty-cart state. Guests can use the cart (saved in a cookie); it merges into the account on login.
5. **Checkout + confirmation** — login required; shipping address form with validation; flat $5 shipping, free over $75; mock payment (card data format only — nothing is charged or stored); order is saved and stock is reduced; confirmation page with order number and summary.
6. **Sign-up / Login** — email + password; inline errors for wrong password or existing email.
7. **Account / profile** — name, email, saved shipping address (editable); order history list with each order's details.
8. **Favorites / wishlist** — login required; heart toggle on cards and product page; wishlist page with move-to-cart and remove; empty state.

## v1 Scope — OUT

- Real payments
- Product reviews / ratings
- Recommendations
- Coupons / discounts
- Taxes
- Returns / refunds
- Color variants
- Size-recommendation quiz
- Email notifications
- Password reset
- Social login
- Admin dashboard
- Multi-vendor
- Other sports
- Multi-language / multi-currency
