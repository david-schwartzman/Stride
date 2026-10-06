# Launch & Polish — Product Brief

> Epic: epic.md · Product: ../../mission.md

## Goals

After the first four epics, all 8 pages work, but only locally and on PR previews, and each page handles edge cases differently. A beginner who hits a blank screen, a raw error or a broken link loses confidence, which is the opposite of what Stride promises.

- A production deploy on Vercel with its own Neon production database, migrations applied and the catalog loaded.
- Consistent, friendly error, loading and 404 states across all 8 pages, matching Figma. The empty states built in earlier epics are checked for consistency, not rebuilt.
- Basic launch quality: mobile-responsive layouts, keyboard and screen-reader basics, page titles/meta for SEO, fast first load.
- A final end-to-end check that the full shopping flow works on production in under 3 minutes.

## User Stories

- As a beginner runner, I can open Stride at a real URL and browse a stocked catalog, so the store feels trustworthy.
- As a shopper, when something fails or a link is broken, I get a clear error or 404 page with a next step, not a raw error.
- As a shopper, while a page loads, I see a loading state instead of a blank screen.
- As a shopper, empty states (no results, empty cart, empty wishlist, no orders) look and behave the same on every page.
- As a shopper on my phone, I can use and read every page.
- As a keyboard or screen-reader user, I can complete a purchase.
- As the team, we can deploy to production and run migrations and the catalog load safely.

## Success Criteria

- Stride is live on a production Vercel URL backed by the production Neon database, with migrations applied and the catalog loaded.
- Every route (all 8 pages, 11 routes) has error, loading and not-found states where applicable, matching Figma. No page shows a blank screen or a raw error.
- The empty states from earlier epics use one shared look and match Figma.
- Every page is usable at 375px width, and every page has a title and meta description.
- Lighthouse accessibility is ≥ 90 on Home, Catalog and Product.
- A keyboard-only run from landing to a confirmed order succeeds.
- First-load performance target: TBD (set when shaping `responsive-a11y-pass`).
- Playwright: landing → confirmation passes against the production URL in under 3 minutes.

## Out of Scope

- New empty states for areas that earlier epics already own (catalog-search, cart-checkout, account-wishlist); this epic only aligns them
- Analytics and error-monitoring services (none in v1, per dependencies.md)
- Admin dashboard
- Phase 2 roadmap items
