# Product Roadmap

## Core Features (current state)

None — greenfield product.

## Phase 1: MVP

The 8 required pages (full rules in [mission.md](mission.md#v1-scope--in)), built in this order:

1. **Catalog** — Home, Catalog (search, filter, sort), Product detail
2. **Auth** — Sign-up / Login, protected routes
3. **Cart + Checkout** — Cart (guest cookie, merge on login), Checkout, Confirmation (mock payment)
4. **Account + Wishlist** — Account / profile with order history, Favorites / wishlist
5. **Deploy + polish** — production deploy on Vercel; empty and error states polished end to end

**Why this order:** catalog first because everything depends on products → auth, needed for checkout, wishlist and order history → cart + checkout, the core purchase → account + wishlist, which depend on auth and orders → deploy and polish.

## Phase 2: Post-Launch

### Next

- "First race kits": bundles by goal (e.g. everything for your first 5K)
- Size guide per product
- Color variants
- Password reset and order confirmation emails
- Guest checkout

**Why this order:** they build directly on the v1 catalog/checkout and add the most value for beginners.

### Later

- Real payments (Stripe)
- Reviews and ratings
- Personalized recommendations
- Coupons
- Returns flow
- Admin dashboard for managing products

**Why this order:** each needs new infrastructure or content (payment provider, moderation, enough users for recommendations) that a 4-week build can't justify.
