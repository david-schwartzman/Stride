# Stride design handoff

Designs for the Stride capstone, matching `softwareos/products/stride/mission.md` and the 5 epics.

## What's here

- `design-system/tokens.json`: colours, type, spacing, radius, shadows, breakpoints. Turn these into the Tailwind theme.
- `design-system/tokens.css`: the same tokens as CSS variables.
- `design-system/README.md`: brand rules and design principles (lime #D4FF3A only for actions, plain language, ≤3 products per row, 375px).
- `design-system/components/`: reference components (Button, Badge, Price, Input, SizePicker, QuantityStepper, WishlistButton, ProductArt, ProductCard, CartItem, Header).
  - `index.d.ts`: their props.
  - `bundle.css` / `bundle.js`: reference styles and markup.
  - One folder per component with a README.
- `pages/*.dc.html`: every page and state as a visual reference: layout, copy and sample data. They use the design canvas format, so they don't run on their own. Rebuild them as Next.js + Tailwind components; don't copy them.
- `pages/canvas.json`: board titles, including each page's route.

## Page → route

| File | Route |
|---|---|
| Main | `/` |
| Catalog, CatalogEmpty, CatalogLoading | `/catalog` |
| Product, ProductSoldOut | `/product/[slug]` |
| Cart, CartEmpty | `/cart` |
| Checkout, CheckoutErrors | `/checkout` |
| OrderConfirmed | `/checkout/confirmation/[orderId]` |
| Login | `/login` |
| Signup | `/signup` |
| AccountOrders, AccountNoOrders | `/account` |
| OrderDetail | `/account/orders/[orderId]` |
| Wishlist, WishlistEmpty | `/wishlist` |
| NotFound | `not-found.tsx` |
| ErrorPage | `error.tsx` / `global-error.tsx` |
| Footer | shared layout |
| Mobile* | the same pages at 375px |

## Suggested prompt for Claude Code

> Read `softwareos/products/stride/mission.md` and everything in `design/`. Turn `design/design-system/tokens.json` into the Tailwind theme. Build the components in `design/design-system/components/index.d.ts` as React components in `components/ui/`, matching `bundle.css`. Use `design/pages/*.dc.html` only as the visual reference for each page; don't copy them. Start with the Header, ProductCard and the Home page, then stop so I can review.
