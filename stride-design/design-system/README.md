# Stride

**Gear that keeps up.** Stride is an online running store for **beginner runners getting ready for their first 5K/10K**: a small, hand-picked catalog of shoes, apparel and gear, organised by the kind of running you do (Road · Trail · Race day), with plain-language guidance tags so beginners can buy with confidence. This design system is the single source for how the store looks, sounds and behaves, built for a four-week Moveo Academy capstone: all 8 v1 pages (home, catalog, product, cart, checkout + confirmation, sign-up / login, account, wishlist) are made from these tokens and components.

The look in one line: **near-black and white with one shot of volt, condensed uppercase headlines, products on light-grey wells, pill buttons.** Energetic, never noisy — the way the big sports stores look, in Stride's own colours.

## The brief

**Problem:** beginners are overwhelmed. Big sports retailers have hundreds of running shoes described with words like *drop*, *pronation* and *stack height*, so beginners buy the wrong thing or don't buy at all.

**Who we design for:** one person — someone who just decided to run their first 5K or 10K. Motivated, not an expert. They want to hear *"this is fine for you"* and buy quickly.

**What Stride does:** a small catalog (~30 products: shoes, apparel, gear), organised by **the kind of running you do** (Road · Trail · Race day), every product with a **plain-language beginner tag**, and a fast path: landing → catalog → product → cart → checkout → confirmation. **Being smaller is the feature:** less choice, clearer guidance, faster decisions.

## Design principles

| Choice | Why (for the beginner) |
| --- | --- |
| Clean, uncluttered layout with lots of white space | Big retailers feel overwhelming; Stride should feel calm. Less on screen, less to decide. |
| Large product images, few products per row (max 3) | Beginners choose with their eyes. Big images help more than spec sheets. |
| Beginner tag as a clear badge on cards and product pages | It's what makes Stride different — the first thing you notice (volt tint + check icon, right under the image). |
| Shop by run type (Road / Trail / Race day) on the home page | Beginners know what they're training for, not product jargon. Start from their goal. |
| Plain language everywhere, no jargon | "Good for your first 5K", not "8 mm drop, neutral". Technical numbers, if shown, go last and small. |
| One strong accent colour for actions — **volt `#D4FF3A` with ink text** | Used only for Shop, Add to bag, Checkout, Place order. The next step is always obvious — that's what makes the 3-minute goal possible. Badges and bands use ink and greys. |
| Shipping rule visible ($5, free over $75); stock shown per size | No surprises at checkout builds trust. |
| Friendly empty and error states | No dead ends and no "it's empty" messages: every state gives a next step (*Clear filters*, popular picks, *Back to catalog*). |
| Mobile-friendly (works at 375 px) | People shop for running gear on their phones. Grids collapse to one column; the header becomes logo + menu + search + cart. |

## Content fundamentals — how Stride talks

- **Guide, don't overwhelm.** Talk to a first-timer. Every product gets one plain-language tag: *Good for your first 5K*, *Great for trails*, *Race-day ready*. No jargon without a reason.
- **Short and active.** Coach, don't lecture. *Built for long miles.* not *This product has been designed to support runners.*
- **Second person, present tense.** *You'll stay dry.* *Your order is on its way.*
- **Headlines are uppercase display type, 2–5 words:** *YOUR FIRST 5K STARTS HERE*, *SHOP BY RUN*, *RACE DAY*.
- **Buttons are verbs:** *Add to bag*, *Checkout*, *Shop trail*. Never *Click here* or *Submit*.
- **Product names** = line + item: *Stride Glide Road Shoe*, *Aero Knit Running Tee*, *Pace 5" Running Shorts*. Title case.
- **Numbers are exact:** *Free shipping over $75*, *$5 shipping*, *Only 2 left in US 9*. All prices in USD.
- **Errors say how to fix it:** *Enter a valid postcode.* — never *Invalid input*.
- We say **bag** in buttons (*Add to bag*) and **cart** for the page (*Your cart*). No emoji in UI copy.

## Visual foundations

### Colour

A neutral-first palette with **one brand colour**. Most of any screen is `surface`, `surface-alt` and `ink`; **volt** is reserved for actions — buttons that move you toward the order — so it always means *next step*. Editorial moments stay calm: light-grey (`surface-alt`) panels with ink type, and at most one ink block per page.

| Role | Token | Rule |
| --- | --- | --- |
| Page | `surface`, `surface-alt` | White page; light grey wells behind product photos and summary panels. |
| Text | `ink`, `ink-muted` | Ink for everything important; muted for metadata only. |
| Action | `volt` + `on-volt` | Action buttons only (*Shop*, *Add to bag*, *Checkout*, *Place order*), plus the cart count and logo slash. **Never as text on light surfaces** — use `volt-text` when volt must be a word or link. |
| Guidance | `volt-soft` + `volt-text` | Beginner guidance tags, tip boxes, active filter chips. |
| Panels | `surface-alt`, `surface-inverse` | Light-grey panels for hero and guidance; one ink block per page at most (footer excluded). |
| Inverse | `surface-inverse` + `on-inverse` | Announcement bar, footer, hero bands. |
| Error | `sale`, `sale-soft` | Field errors, failed actions, *Remove* — always with words, so it's never read as a status colour. (v1 has no discounts; the token keeps its name.) |
| Success | `success`, `success-soft` | *In stock*, *Order confirmed*. Always with a word or icon — never colour alone. |
| Lines | `line`, `line-strong` | Hairline dividers; input and chip borders. |
| Focus | `focus` / `focus-ring` | Every interactive element on keyboard focus (ink ring outside a surface gap). |

Light and dark themes are both defined; light is the default storefront. All text pairs meet 4.5:1 in both themes; control borders and the focus ring meet 3:1.

### Typography

Two Google Fonts families:

- **Barlow Condensed** (`--font-display`, 700–800) — headlines, always **UPPERCASE**, tight leading (0.92–1.1). Styles `display-xl` → `display-sm`.
- **Inter** (`--font-sans`, 400–700) — everything else. `title` for product names, `body` for descriptions, `body-sm` for metadata, `label` (12px, bold, 0.08em tracking, uppercase) for badges, form labels and eyebrows, `price` with tabular numerals.

Load them with:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap">
```

### Spacing, layout and shape

- 4px base: `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-6` 24 · `space-8` 32 · `space-12` 48 · `space-16` 64.
- Page gutter `space-4` on mobile, `space-8` on desktop; max width 1280px (`bp-lg`). Sections are `space-12` apart on mobile, `space-16` on desktop.
- Product grid: 2 columns → 3 at `bp-md` (960px) → 4 at `bp-lg`, gap `space-6`. Catalog filters (category, run type, gender, price) become a left sidebar from `bp-md`.
- **Sharp by default.** Photos, heroes and the header have no radius (`radius-none`); cards, inputs, chips and badges get a 2px edge (`radius-sm`). **Buttons and the quantity stepper are pills** (`radius-pill`) — the one round shape, so actions are easy to spot.
- Cards stay flat (no shadow). `shadow-raised` is only for things that float: the cart drawer, dropdowns, the sticky add-to-bag bar.
- Motion: 120ms ease for hover/press, 300ms for drawers; a 4% zoom on product images on hover. Respect `prefers-reduced-motion`.

### Imagery

Until real photos exist, every product uses **`ProductArt`** — a flat illustration of the product on a light-grey well (`stone`), with the occasional `volt` or `ink` well for rhythm. With photos: 4:5, product centred on the same grey, same crop across a grid — the look of the big sports stores.

## Iconography

Simple line icons: 24px grid, 2px stroke, round caps and joins, `currentColor`. The header ships *search*, *account*, *heart* (wishlist) and *bag*; draw any others (filter, close, chevron, truck, lock) in the same style — [Lucide](https://lucide.dev) matches it. Icon-only buttons always have an `aria-label`.

## Logo

No logo file yet: the mark is the word **STRIDE** set in Barlow Condensed 800, uppercase, followed by a short volt slash skewed -18° (see the `Header` component). Keep it on `surface` or `surface-inverse`; never recolour the word in volt.

## Patterns borrowed from the big sports stores

Referenced from Nike, adidas and On (home, running-shoe listing, product page). What shoppers already know — use these instead of inventing new ones:

- **Utility bar (Help · Orders · Sign in) + announcement bar + sticky header** with logo, category nav, a real **search field** (not just an icon), account / wishlist / cart icons.
- **Full-bleed hero** with one condensed headline bottom-left and two CTAs (*Shop now →* + secondary).
- **"Latest drops" collection carousel** (image, title, one line, *Shop now*) and a **tabbed product rail** (*Beginner picks · Shoes · Trail*) of 4 cards, then big **image category tiles** with the label on the image.
- **Guidance band** between rails — a calm light-grey block with one big line and one CTA (here *No jargon*).
- **Trust strip** with icons (shipping, secure checkout, hand-picked) above a dense, multi-column footer.
- **Catalog:** title with count (*Shop all (12)*), quick-pick tiles above the grid, filters left with *Hide filters*, *Sort by* top right, 3-column grid; cards show badge (*Just in*, *Best seller*), name, one-line subtitle, price.
- **Product page:** breadcrumbs; gallery 2×2 left; **sticky buy box** right in this order: name, subtitle, price, size grid, one size-advice line, *Add to bag*, *Add to wishlist*; delivery note; accordions for details.
- **Cart/checkout:** summary panel always visible, free-shipping progress, distraction-free checkout header, autocomplete on every field.

## Store map — the 8 v1 pages

| Route | Page | Built from |
| --- | --- | --- |
| every page | — | `Header` (nav Shoes · Apparel · Gear, search, account, wishlist, cart), footer on `surface-inverse` |
| `/` | Home | `display-xl` hero, shop-by-category and shop-by-run-type tiles, featured `ProductCard`s |
| `/catalog` | Catalog | search box, filters (category, run type, gender, price range), sort by price, `ProductCard` grid, no-results state |
| `/product/[slug]` | Product detail | gallery, guide `Badge`, `Price` (lg), `SizePicker` (shoes US 6–13 incl. halves · apparel XS–XL · gear one size), `QuantityStepper`, accent *Add to bag*, `WishlistButton` (full); *Out of stock* state |
| `/cart` | Cart | `CartItem` rows, summary (subtotal, $5 shipping or free over $75, total), empty state |
| `/checkout` | Checkout | login required; shipping address `Input`s with validation; mock card fields (nothing charged or stored); accent *Place order* |
| `/checkout/confirmation/[orderId]` | Confirmation | order number, summary, address |
| `/login`, `/signup` | Auth | email + password `Input`s with inline errors (wrong password, email already used) |
| `/account`, `/account/orders/[orderId]` | Account | editable name, email, saved address; order history and order detail |
| `/wishlist` | Wishlist | `ProductCard` grid with *Move to cart* / *Remove*; empty state |

Out of v1 (don't design for them yet): real payments, reviews, recommendations, coupons/discounts, colour variants, emails, password reset, guest checkout, admin.

## Using it with Tailwind

The stack is Next.js + Tailwind. Put the token variables (`tokens.css`) in `app/globals.css`, then point Tailwind at them so classes use the system: `theme.extend.colors = { surface: 'var(--surface)', ink: 'var(--ink)', 'ink-muted': 'var(--ink-muted)', volt: 'var(--volt)', 'on-volt': 'var(--on-volt)', … }`, `fontFamily = { display: 'var(--font-display)', sans: 'var(--font-sans)' }`, `borderRadius = { sm: 'var(--radius-sm)', pill: 'var(--radius-pill)' }`. Then `bg-volt text-on-volt rounded-pill` is the accent button.

## Accessibility checklist

- A *Skip to content* link is the first focusable element (in `Header`); main content has `id="main"`.
- Every control shows `focus-ring` on `:focus-visible`.
- Respect `prefers-reduced-motion` — hover zooms and arrow nudges switch off.
- Touch targets ≥ 44px (buttons and chips are 48px).
- Error and success are never told apart by colour alone — both carry words.
- Sold-out sizes are disabled *and* announced as sold out.
- The wishlist heart is a real button with `aria-pressed`, never only an icon change.
- Form fields have visible labels; errors are linked with `aria-describedby`.
