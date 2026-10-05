# Catalog & Search — Product Brief

> Epic: epic.md · Product: ../../mission.md

## Goals

Big retailers overwhelm beginner runners with thousands of options, so someone preparing for their first 5K/10K can't tell which shoes, apparel or gear they actually need.

- Show a small, hand-picked catalog organized by category and run type.
- Let shoppers find what fits them fast: search, filters (category, run type, gender, price range) and price sort.
- Give every product page clear sizes, per-size stock and plain-language beginner guidance tags so shoppers can choose with confidence.
- Server-render the catalog so it's fast and gives cart and checkout a foundation to build on.

## User Stories

- As a beginner runner, I see featured products and "shop by category / shop by run type" on the home page so I know where to start.
- As a shopper, I can search products by name so I find something I've heard of.
- As a shopper, I can filter by category (Shoes/Apparel/Gear), run type (Road/Trail/Race day), gender (Men/Women/Unisex) and price range, and sort by price, so I only see what fits me.
- As a shopper, I see a clear "no results" state with a way to clear filters when nothing matches.
- As a shopper, I can open a product and see images, price (USD), description and a beginner tag like "good for your first 5K".
- As a shopper, I can pick a size (shoes US 6–13 incl. half sizes; apparel XS–XL; gear one size). Sold-out sizes are visible but disabled.
- As a shopper, a fully sold-out product still shows its page with "Out of stock".
- As a shopper, filtered/search URLs are shareable and survive a refresh.

## Success Criteria

- Home, /catalog and /product/[slug] are server-rendered: the first HTML response already contains the products.
- Search, every filter and sort work alone and combined, and are reflected in URL params.
- The no-results and out-of-stock states match the Figma frames.
- Size rules and stock per size display correctly for shoes, apparel and gear.
- The seed script loads the ~30-product catalog with images from /public.
- Prices are stored as integer cents and shown as USD.
- Playwright e2e: landing → catalog → filter → product detail passes in CI.

## Out of Scope

- TBD
