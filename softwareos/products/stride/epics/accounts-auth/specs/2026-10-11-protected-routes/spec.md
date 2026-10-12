# Protected Routes & Session Header

> Epic: ../../epic.md
> Status: shaped
> Branch: feat/accounts-auth/protected-routes
> Covers: src/middleware.ts, src/proxy.ts, src/lib/callback-url.ts, src/features/session/**, e2e/protected-routes.spec.ts

## Overview

Third spec of Accounts & Auth (security-headers, session-management and auth-event-logging follow). Builds on `app-foundation` (layout, Header with `accountName` prop) and `signup-login` (the `src/lib/auth/` module with `getCurrentSession()` and the session cookie, `signOutAction`, `/login` + `/signup`). It closes every handoff signup-login left open:

- A route guard for /checkout, /account, /wishlist that sends logged-out shoppers to `/login?callbackUrl=<path>`.
- A safe return-to: login and sign-up land back on `callbackUrl` (same-origin paths only) instead of `/`.
- A session-aware header: signed-in state, an account link, and a Log out button.
- The "Log in to check out" banner on /login when arriving from /checkout.
- The epic's full Playwright journey: sign up → log out → log in → reach a protected page. It also owns the browser-level logout checks signup-login handed over (its AC11/AC16).

Serves these epic success criteria:
- Login sets an httpOnly session cookie, **and the header shows logged-in state**.
- Middleware protects /checkout, /account, /wishlist, with a working return-to redirect.
- Playwright: sign up → log out → log in → reach a protected page passes in CI.

And the mission: checkout and wishlist require login. The protected pages themselves belong to cart-checkout and account-wishlist. This spec ships the guard plus a `requireUser()` helper those pages call.

## Goals & User Stories

- As a logged-out shopper, opening /checkout, /account or /wishlist (or any sub-path) sends me to login, then back to that exact page.
- As a shopper arriving at login from checkout, I see that my cart is saved, so I'm not worried about losing it.
- As a shopper who has no account yet, I can follow "Create an account" from that login page and still land back where I was going.
- As a logged-in shopper, the header shows I'm signed in and I can log out from it, on desktop and mobile.
- As a developer on cart-checkout / account-wishlist, I have one helper that guarantees a signed-in user in a page or Server Action.

## Acceptance Criteria

1. AC1: A logged-out request to `/checkout`, `/account`, `/wishlist` or any sub-path (e.g. `/account/orders/abc`) redirects to `/login?callbackUrl=<encoded path + query>`. Other routes (`/`, `/login`, `/signup`, catalog, product, cart, static assets) are never redirected.
2. AC2: After a successful login from `/login?callbackUrl=X`, the shopper lands on X if it is a safe internal path, otherwise on `/`. The same holds for sign-up when `callbackUrl` was carried over from the login page's "Create an account" link.
3. AC3: `callbackUrl` only accepts same-origin relative paths. `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:…`, encoded variants (`%2F%2Fevil.com`), and empty/garbage values all fall back to `/`. A `callbackUrl` pointing at `/login` or `/signup` also falls back to `/` (no loop).
4. AC4: A logged-in shopper who opens `/login?callbackUrl=X` or `/signup?callbackUrl=X` is redirected straight to safe X (signup-login's AC9 redirects to `/`; this extends it to honour callbackUrl).
5. AC5: `/login?callbackUrl=/checkout…` shows the design's status banner: "**Log in to check out.** Your cart is saved and will be added to your account." (`role="status"`, volt-soft background). It isn't shown for any other callbackUrl or for direct visits.
6. AC6: When signed in, the header shows the signed-in state per the Header README: `accountName` is set (green dot on the account icon, its label names the user), and the account icon links to `/account`. The Header's `utility` slot (app-foundation AC7) reads "My orders · Log out" instead of "My orders · Sign up · Log in", where Log out is the `LogoutButton` form (AC7).
7. AC7: "Log out" is a form button that calls signup-login's `signOutAction`, clears the session and lands on `/`. It works without JavaScript, works from the mobile drawer, and leaves the header signed-out after redirect.
8. AC8: When signed out, the header matches app-foundation's AC7: account → `/login`, and the `utility` slot is app-foundation's default signed-out row "My orders · Sign up · Log in".
9. AC9: `requireUser(path)` from `src/features/session` validates the database session through signup-login's `getCurrentSession()` and returns `{ id, email, name }` for a signed-in user; otherwise it redirects to `/login?callbackUrl=<path>`. It's the documented server-side check protected pages and Server Actions call, so they don't rely on the guard alone.
10. AC10: The guard checks only that a session cookie is present (no database). `getCurrentSession()` / `requireUser()` treat a missing, expired, revoked (logged-out) or tampered token as logged out, so a page or action behind the guard still redirects to login, and the header shows signed-out.
11. AC11: Playwright passes in CI against a real Postgres: sign up → log out via the header button → open `/account` → land on login → log in → land back on `/account` signed in. A second test checks the /checkout banner and an open-redirect attempt (`/login?callbackUrl=//evil.com` → `/`). A third copies the session cookie before logging out, restores it after, and confirms `/account` still redirects to login (signup-login's AC16 at browser level).
12. AC12: On a GET page request that carries the session cookie, the guard response re-sends that cookie with the same name, value and attributes (signup-login AC6) and `Max-Age` 30 days, so the browser cookie keeps up with sliding renewal. Requests without the cookie, and non-GET requests, set no cookie. The database `expiresAt` stays the source of truth.

## Technical Approach

- **Guard file:** `src/proxy.ts` on Next.js 16+ (Node runtime), `src/middleware.ts` on 15. T1 confirms which one app-foundation installed. It imports no auth library and no Prisma: `isLoggedIn` = the session cookie is present (name from signup-login's `src/lib/auth/cookie.ts`). Its matcher covers all page routes (excluding `_next/static`, `_next/image`, favicon and other static files) but it only redirects `PROTECTED_PREFIXES`. On GET requests that carry the cookie it calls `refreshSessionCookie(response, token)`, which this spec adds to signup-login's `src/lib/auth/cookie.ts` (same attributes, Max-Age 30 days; AC12), so the browser cookie keeps up with sliding renewal (Server Components can't set cookies). The proxy never writes a cookie itself: per `auth-security`, only `src/lib/auth/` touches cookies. `cookie.ts` must stay free of Prisma and Argon2 imports so the proxy can load it. The database `expiresAt` stays the source of truth.
- **Decision logic** lives in a pure function `src/features/session/guard.ts`: `guard({ pathname, search, isLoggedIn }) → { redirect?: string }`. The proxy file is a thin adapter, so the logic is unit-testable without a Next request. Protected prefixes are one exported const, `PROTECTED_PREFIXES`, shared with tests.
- **Safe callback:** `src/lib/callback-url.ts` exports `safeCallbackUrl(raw: unknown): string`. Rules:
  - Decode once and require the value to start with a single `/` (no `//` and no `/\`).
  - Resolve with `new URL(raw, "http://local")` and require the origin to be unchanged.
  - Strip it back to `pathname + search + hash`.
  - Reject `/login` and `/signup` prefixes, and cap the length at 2048.
  - On any failure return `/`.

  `buildLoginUrl(path)` builds the redirect target. Both the guard and `requireUser()` use it.
- **Return-to wiring (edits signup-login's files; it handed this off explicitly):**
  - The `/login` and `/signup` pages read `searchParams.callbackUrl`, sanitise it, and pass it to the form as a hidden `callbackUrl` input.
  - The already-signed-in redirect goes to the sanitised value.
  - `loginAction` / `signupAction` read `formData.get("callbackUrl")`, re-sanitise it on the server (never trust the hidden field), and `redirect(safe)` instead of `redirect("/")`.
  - The "Create an account" / "Log in" cross-links carry `callbackUrl` along.
  - `onSignedIn` stays where it is, before the redirect.
- **Banner:** `src/features/session/LoginBanner.tsx` (Server Component) renders the design's status banner when the sanitised callbackUrl starts with `/checkout`. `/login/page.tsx` renders it above the heading.
- **Session header:**
  - `src/features/session/HeaderSession.tsx` (async Server Component) calls `getCurrentSession()` and renders the Header's account state: it passes `accountName` and `accountHref`, and when signed in a `utility` node of "My orders" + `<LogoutButton />` (signed out it passes nothing, so the Header's default row shows).
  - Log out is `src/features/session/LogoutButton.tsx`: a `<form action={signOutAction}>` with a submit button, so no client JS is needed. It's styled as a utility link, and the mobile drawer shows it too.
  - `src/app/layout.tsx` (app-foundation) renders the Header through `HeaderSession`. This is a small wiring edit. The Header API is unchanged; it already takes `accountName` and the `utility` slot (app-foundation AC7).
  - Calling `getCurrentSession()` reads cookies, so the header goes dynamic. Wrap `HeaderSession` in `<Suspense>` with the signed-out header as the fallback, so a static/PPR shell stays possible for catalog pages.
- **requireUser:** `src/features/session/require-user.ts`. `getCurrentSession()` (cached per request, one indexed DB lookup) → `session.user` or `redirect(buildLoginUrl(path))`. It can't delete a stale cookie from a Server Component; the cookie is cleared by the next Server Action or expires. For Server Actions, the caller passes the page path it wants to return to.
- **Placeholder:** `src/app/account/page.tsx` is a throwaway that calls `requireUser("/account")` and shows "Signed in as {name}", so the e2e journey has a real protected page. It's **not** claimed: account-wishlist owns `/account` and replaces it. Until cart-checkout ships `/checkout`, a logged-in visit to `/checkout` 404s. That's expected and not a QA failure.
- **Tests:** CI and the Postgres service already exist (signup-login T12). Add `e2e/protected-routes.spec.ts` with a unique email per run.

## Out of Scope

- The real /checkout, /account, /wishlist pages (cart-checkout, account-wishlist). Only the /account placeholder ships here.
- Guest-cart merge itself (cart-checkout / guest-cart-merge). The banner only promises it; signup-login's `onSignedIn` hook is the seam.
- A wishlist-specific login banner variant. The design copy is checkout-specific, so the banner shows for /checkout only.
- Heart-toggle guest redirect in Server Actions (account-wishlist uses `requireUser`).
- Role-based / admin authorization; per-resource ownership checks (each feature scopes its queries to `session.user.id`).
- "Your devices" list, sign out of other devices, change password (candidate `session-management`). Login throttling and logout revocation are signup-login's. "Remember me" (sessions already last 30 days of activity).
- Password reset, social login, email verification (epic Out of Scope).

## Standards Applied

- [global/tech-stack](../../../../../../standards/global/tech-stack.md): opaque database session in an httpOnly cookie, Server Actions for auth (logout), server-render by default (Server Component header, no-JS logout form), Vitest + RTL + Playwright.
- [global/auth-security](../../../../../../standards/global/auth-security.md): the proxy is not authorization, `requireUser()` in every protected page and action, user ID only from the session, relative-only redirects, POST-only logout.
- [global/git-workflow](../../../../../../standards/global/git-workflow.md): branch off `develop`, PR to `develop`, `feat(accounts-auth): …` commits.

## Changelog

| Date | Author | Type | Change | Ref |
|---|---|---|---|---|
| 2026-10-11 | david-schwartzman | created | Initial shaping | — |
| 2026-10-11 | david-schwartzman | change | Guard checks cookie presence only (no NextAuth/authConfig), matcher widened to all pages with cookie Max-Age refresh on GET; requireUser and header use getCurrentSession(); AC1, AC9, AC10, Technical Approach, Out of Scope, Standards Applied updated — adopt Stride Auth & Session Security Plan: Auth.js Credentials is JWT-only (no revocation); move to own DB-session module + Argon2id | https://claude.ai/artifact/QL1DDEEN6QERM6GsZP4a8h |
| 2026-10-12 | david-schwartzman | change | Overview no longer says "last spec"; proxy cookie refresh goes through `refreshSessionCookie` in `src/lib/auth/cookie.ts` (no direct cookie writes); AC6/AC8 use app-foundation's `utility` slot; AC11 adds the old-cookie-after-logout check handed over by signup-login; AC12 added for the Max-Age refresh; T3/T9/T11 updated — PR #12 review | https://github.com/david-schwartzman/Stride/pull/12 |
