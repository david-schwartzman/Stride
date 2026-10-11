# References for Protected Routes & Session Header

## Related Specs

No ownership overlaps were found in the cross-tree pre-flight check. This spec does edit files its siblings own, because both of them handed this work off explicitly:

- **[Related]** [2026-10-08-signup-login](../2026-10-08-signup-login/spec.md) — this spec edits `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/features/auth/actions.ts`, `LoginForm.tsx` and `SignupForm.tsx` to add `callbackUrl` return-to and the /checkout banner. signup-login's Overview and Out of Scope hand exactly these to protected-routes. Kept separate because signup-login owns the identity flow; this spec owns where the shopper goes after it.
- **[Related]** [2026-10-08-app-foundation](../2026-10-08-app-foundation/spec.md) — this spec edits `src/app/layout.tsx` (renders the Header through `HeaderSession`) and the mobile drawer in `src/components/layout/` (adds Log out). The Header's `accountName` / `accountHref` props were designed for this; its API doesn't change. Kept separate because app-foundation owns the shell; this is the planned "header session state" handoff.
- **[Related]** [account-wishlist tech plan](../../../account-wishlist/tech-plan.md) and [cart-checkout tech plan](../../../cart-checkout/tech-plan.md) — their protected pages (/account, /wishlist, /checkout) rely on this guard and call `requireUser()` from `src/features/session`. The throwaway `src/app/account/page.tsx` placeholder is unclaimed, and account-wishlist replaces it.

## Upstream Meeting

None.

## Similar Implementations

Greenfield: no app code exists yet. The references are the sibling specs and the design handoff, which is used in place rather than copied into `visuals/`.

### signup-login spec

- **Location:** `../2026-10-08-signup-login/spec.md` (Technical Approach)
- **Relevance:** The guard, logout and return-to all build on it.
- **Key patterns:**
  - The auth module lives in `src/lib/auth/` (no auth library). The proxy only needs the cookie name from `cookie.ts`; `getCurrentSession()` from `current.ts` is the real check used by `requireUser()` and the header. (Updated 2026-10-11: previously an edge-safe `auth.config.ts` imported via `NextAuth(authConfig)`.)
  - `signOutAction` already exists; the header form calls it.
  - The Server Actions currently `redirect("/")`; this spec swaps that for the sanitised `callbackUrl`.
  - `runOnSignedIn` runs before the redirect, and that order stays.

### Header component

- **Location:** `stride-design/design-system/components/Header/README.md`, `index.d.ts`, plus the app-foundation spec's Layout bullet
- **Relevance:** AC6, AC7, AC8.
- **Key patterns:**
  - `accountName` adds a green dot to the account icon and its label names the user.
  - `accountHref` sets where the account icon links.
  - The `utility` row is a list of `{ label, href }` links; the designs use "My orders · Sign up · Log in".
  - The Header takes props, so session wiring happens in the layout and the Header API stays unchanged.

### Login banner and header designs

- **Location:**
  - `stride-design/pages/Login.dc.html` (status banner, around line 34)
  - `stride-design/pages/Main.dc.html` and `MobileHome.dc.html` (header utility row)
- **Relevance:** AC5, AC6.
- **Key patterns:**
  - The banner is a `role="status"` div on `--volt-soft`, 12px/16px padding, 14px/20px text: "**Log in to check out.** Your cart is saved and will be added to your account."
  - The design comment says it shows when a guest is redirected from /checkout or /wishlist. The copy only fits checkout, so it ships for /checkout only.
  - These pages are visual references only: rebuild them, don't copy them.

## Decisions

- **proxy.ts vs middleware.ts:** follow the installed Next.js major. Next 16 renamed middleware to `proxy.ts` (Node runtime). Covers lists both names, and T1 confirms which applies.
- **Defense-in-depth:** the guard only checks that a cookie is present, so protected pages and Server Actions must call `requireUser()`, which validates the database session. Middleware has also been bypassable before.
- **Server re-sanitises `callbackUrl`:** the hidden form field is never trusted.
- **Header in `<Suspense>`:** reading `getCurrentSession()` (cookies) makes the header dynamic. The signed-out fallback keeps a static/PPR shell possible for catalog pages.
