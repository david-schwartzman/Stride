# Protected Routes & Session Header

> Epic: ../../epic.md
> Status: shaped
> Branch: feat/accounts-auth/protected-routes
> Covers: apps/web/src/middleware.ts, apps/web/src/proxy.ts, packages/shared/src/callback-url.ts, packages/shared/src/session-cookie.ts, apps/web/src/features/session/**, apps/web/e2e/protected-routes.spec.ts

## Overview

Third spec of Accounts & Auth (security-headers, session-management and auth-event-logging follow). Builds on `app-foundation` (layout, Header with `accountName` prop), `signup-login` (`/login` + `/signup` and the auth behaviour) and the specs that moved that behaviour into the NestJS API (`apps/api`, reached through the same-origin `/api` rewrite): `api-foundation` and `auth-api-migration`. The API auth module (`apps/api/src/auth/`, owned by `auth-api-migration`) owns the session cookie, `GET /auth/me`, the `AuthGuard` and logout (`POST /auth/logout`); `getCurrentSession()` calls it from the web. It closes every handoff signup-login left open.

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
- As a developer on cart-checkout / account-wishlist, I have one web helper that guarantees a signed-in user in a page, and one API guard that guarantees it on an endpoint.

## Acceptance Criteria

1. AC1: A logged-out request to `/checkout`, `/account`, `/wishlist` or any sub-path (e.g. `/account/orders/abc`) redirects to `/login?callbackUrl=<encoded path + query>`. Matching is on whole path segments: a path is protected when it equals a prefix or starts with the prefix followed by `/`, so `/account` and `/account/orders` match but `/accounting` and `/wishlists` don't. Other routes (`/`, `/login`, `/signup`, catalog, product, cart, static assets) are never redirected.
2. AC2: After a successful login from `/login?callbackUrl=X`, the shopper lands on X if it is a safe internal path, otherwise on `/`. The same holds for sign-up when `callbackUrl` was carried over from the login page's "Create an account" link.
3. AC3: `callbackUrl` only accepts same-origin relative paths. `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:…`, encoded variants (`%2F%2Fevil.com`), and empty/garbage values all fall back to `/`. A `callbackUrl` pointing at `/login` or `/signup` also falls back to `/` (no loop).
4. AC4: A logged-in shopper who opens `/login?callbackUrl=X` or `/signup?callbackUrl=X` is redirected straight to safe X (signup-login's AC9 redirects to `/`; this extends it to honour callbackUrl).
5. AC5: `/login?callbackUrl=/checkout…` shows the design's status banner: "**Log in to check out.** Your cart is saved and will be added to your account." (`role="status"`, volt-soft background). It isn't shown for any other callbackUrl or for direct visits.
6. AC6: When signed in, the header shows the signed-in state per the Header README: `accountName` is set (green dot on the account icon, its label names the user), and the account icon links to `/account`. The Header's `utility` slot (app-foundation AC7) reads "My orders · Log out" instead of "My orders · Sign up · Log in", where Log out is the `LogoutButton` form (AC7).
7. AC7: "Log out" is a form button that POSTs to `/api/auth/logout` (the API deletes the session, clears the cookie and answers with a 303 to `/`), and lands on `/`. It works without JavaScript, works from the mobile drawer, and leaves the header signed-out after redirect.
8. AC8: When signed out, the header matches app-foundation's AC7: account → `/login`, and the `utility` slot is app-foundation's default signed-out row "My orders · Sign up · Log in".
9. AC9: `requireUser(path)` from `src/features/session` validates the session through the API's `GET /auth/me` (via `getCurrentSession()`, cookie forwarded) and returns `{ id, email, name }` for a signed-in user; otherwise it redirects to `/login?callbackUrl=<path>`. It's the documented check protected pages call, so they don't rely on the guard alone. (On the API, `auth-api-migration`'s `AuthGuard` rejects every protected endpoint call without a valid session with 401; this spec relies on it and doesn't change it.)
10. AC10: The guard checks only that a session cookie is present (no API call, no database). `GET /auth/me`, the `AuthGuard`, `getCurrentSession()` and `requireUser()` treat a missing, expired, revoked (logged-out) or tampered token as logged out, so a page or action behind the guard still redirects to login, and the header shows signed-out.
11. AC11: Playwright passes in CI against a real Postgres: sign up → log out via the header button → open `/account` → land on login → log in → land back on `/account` signed in. A second test checks the /checkout banner and an open-redirect attempt (`/login?callbackUrl=//evil.com` → `/`). A third copies the session cookie before logging out, restores it after, and confirms `/account` still redirects to login (signup-login's AC16 at browser level).
12. AC12: On a GET page request that carries the session cookie, the guard response re-sends that cookie with the same name, value and attributes (signup-login AC6) and `Max-Age` 30 days, so the browser cookie keeps up with sliding renewal. Requests without the cookie, and non-GET requests, set no cookie. The database `expiresAt` stays the source of truth.
    - The name rule (API `NODE_ENV`: `__Host-stride_session` in production, `stride_session` otherwise) lives today in `apps/api/src/auth/session-cookie.ts`. This spec creates `packages/shared/src/session-cookie.ts`, moves the rule there, and the API imports it.
    - The proxy detects whichever of the two names is present on the request and re-sends that cookie with that name's attributes. It never derives the name from the web's `NODE_ENV` (`next start` always runs with `NODE_ENV=production`, while the e2e API runs with `NODE_ENV=test`).

## Technical Approach

- **Paths:** this spec is built after `api-foundation`, so web files live under `apps/web/`. In this spec and its tasks, `src/...` means `apps/web/src/...`.
- **Guard file:** `src/proxy.ts` on Next.js 16+ (Node runtime), `src/middleware.ts` on 15. T1 confirms which one app-foundation installed. `api-foundation` already created this file for the `/api` rewrite and its trusted proxy headers; this spec adds the page guard next to it and leaves the `/api` branch alone. It imports no auth library and no Prisma, and calls no API: `isLoggedIn` = either session cookie name (`__Host-stride_session` or `stride_session`, both from `packages/shared/src/session-cookie.ts`) is present; the web never picks the name from its own `NODE_ENV` (AC12). Its matcher covers all page routes (excluding `_next/static`, `_next/image`, favicon and other static files) but it only redirects `PROTECTED_PREFIXES`. On GET requests that carry the cookie it calls `refreshSessionCookie(response, token)` from `packages/shared/src/session-cookie.ts` (the name rule and attributes, moved here from `apps/api/src/auth/session-cookie.ts` and imported by the API's auth module; it re-sends the cookie under the name it was found with, same attributes, Max-Age 30 days; AC12), so the browser cookie keeps up with sliding renewal (Server Components can't set cookies). The proxy never builds cookie attributes itself. `session-cookie.ts` holds no secrets and imports no Prisma or Argon2. The database `expiresAt` stays the source of truth.
- **Decision logic** lives in a pure function `src/features/session/guard.ts`: `guard({ pathname, search, isLoggedIn }) → { redirect?: string }`. The proxy file is a thin adapter, so the logic is unit-testable without a Next request. Protected prefixes are one exported const, `PROTECTED_PREFIXES`, shared with tests.
- **Safe callback:** `packages/shared/src/callback-url.ts` (used by the web and the API) exports `safeCallbackUrl(raw: unknown): string`. Rules:
  - Decode once and require the value to start with a single `/` (no `//` and no `/\`).
  - Resolve with `new URL(raw, "http://local")` and require the origin to be unchanged.
  - Strip it back to `pathname + search + hash`.
  - Reject `/login` and `/signup` prefixes, and cap the length at 2048.
  - On any failure return `/`.

  `buildLoginUrl(path)` builds the redirect target. Both the guard and `requireUser()` use it.
- **Return-to wiring (edits signup-login's files; it handed this off explicitly):**
  - The `/login` and `/signup` pages read `searchParams.callbackUrl`, sanitise it, and pass it to the form as a hidden `callbackUrl` input.
  - The already-signed-in redirect goes to the sanitised value.
  - `POST /api/auth/login` / `POST /api/auth/signup` read `callbackUrl` from the body, re-sanitise it in the API (never trust the hidden field) and return it as the redirect target; the form navigates there instead of `/`.
  - The "Create an account" / "Log in" cross-links carry `callbackUrl` along.
  - `onSignedIn` stays where it is in the API auth flow, before the response.
- **Banner:** `src/features/session/LoginBanner.tsx` (Server Component) renders the design's status banner when the sanitised callbackUrl starts with `/checkout`. `/login/page.tsx` renders it above the heading.
- **Session header:**
  - `src/features/session/HeaderSession.tsx` (async Server Component) calls `getCurrentSession()` (`GET /auth/me`) and renders the Header's account state: it passes `accountName` and `accountHref`, and when signed in a `utility` node of "My orders" + `<LogoutButton />` (signed out it passes nothing, so the Header's default row shows).
  - Log out is `src/features/session/LogoutButton.tsx`: a `<form method="post" action="/api/auth/logout">` with a submit button, so no client JS is needed (the API answers with a 303 to `/`). It's styled as a utility link, and the mobile drawer shows it too.
  - `src/app/layout.tsx` (app-foundation) renders the Header through `HeaderSession`. This is a small wiring edit. The Header API is unchanged; it already takes `accountName` and the `utility` slot (app-foundation AC7).
  - Calling `getCurrentSession()` reads cookies, so the header goes dynamic. Wrap `HeaderSession` in `<Suspense>` so a static/PPR shell stays possible for catalog pages. The fallback is a **neutral** header: no account dot and a `utility` placeholder of the same width (`aria-hidden`, no links), so a signed-in shopper never briefly sees "Sign up · Log in".
- **requireUser:** `src/features/session/require-user.ts`. `getCurrentSession()` (cached per request; calls `GET /auth/me` at `API_URL` with the incoming cookie forwarded, which is one indexed DB lookup in the API) → `session.user`, or on 401 `redirect(buildLoginUrl(path))`. It can't delete a stale cookie from a Server Component. A revoked or expired cookie stays in the browser until the next auth call (login, sign-up or logout) overwrites or clears it; it doesn't expire on its own, because the guard re-sends any cookie that's present (AC12). That's harmless: every lookup rejects it, so the shopper is treated as logged out.
- **AuthGuard (API, not claimed):** `apps/api/src/auth/auth.guard.ts` and `GET /auth/me` come from `auth-api-migration`. The guard reads the session cookie, validates it through the auth module's session service, and attaches `{ id, email, name }` to the request (401 otherwise). Every endpoint in later epics that needs a user uses it; this is the authorization layer, `requireUser()` is only for rendering.
- **Placeholder:** `src/app/account/page.tsx` is a throwaway that calls `requireUser("/account")` and shows "Signed in as {name}", so the e2e journey has a real protected page. It's **not** claimed: account-wishlist owns `/account` and replaces it. Until cart-checkout ships `/checkout`, a logged-in visit to `/checkout` 404s. That's expected and not a QA failure.
- **Tests:** CI and the Postgres service already exist (signup-login T12). Add `e2e/protected-routes.spec.ts` with a unique email per run.

## Out of Scope

- The real /checkout, /account, /wishlist pages (cart-checkout, account-wishlist). Only the /account placeholder ships here.
- Guest-cart merge itself (cart-checkout / guest-cart-merge). The banner only promises it; signup-login's `onSignedIn` hook is the seam.
- A wishlist-specific login banner variant. The design copy is checkout-specific, so the banner shows for /checkout only.
- Heart-toggle guest redirect (account-wishlist's wishlist endpoint returns 401 via the `AuthGuard`; the heart sends guests to login).
- Role-based / admin authorization; per-resource ownership checks (each feature scopes its queries to `session.user.id`).
- "Your devices" list, sign out of other devices, change password (candidate `session-management`). Login throttling and logout revocation are signup-login's. "Remember me" (sessions already last 30 days of activity).
- Password reset, social login, email verification (epic Out of Scope).

## Standards Applied

- [global/tech-stack](../../../../../../standards/global/tech-stack.md): opaque database session in an httpOnly cookie, the NestJS API owns auth (logout is `POST /api/auth/logout`), the web never touches the database, server-render by default (Server Component header, no-JS logout form), Vitest + RTL + Playwright.
- [global/auth-security](../../../../../../standards/global/auth-security.md): the proxy is not authorization, the `AuthGuard` on every protected endpoint and `requireUser()` in every protected page, user ID only from the session, relative-only redirects, POST-only logout.
- [global/git-workflow](../../../../../../standards/global/git-workflow.md): branch off `develop`, PR to `develop`, `feat(accounts-auth): …` commits.

## Changelog

| Date | Author | Type | Change | Ref |
|---|---|---|---|---|
| 2026-10-11 | david-schwartzman | created | Initial shaping | — |
| 2026-10-11 | david-schwartzman | change | Guard checks cookie presence only (no NextAuth/authConfig), matcher widened to all pages with cookie Max-Age refresh on GET; requireUser and header use getCurrentSession(); AC1, AC9, AC10, Technical Approach, Out of Scope, Standards Applied updated — adopt Stride Auth & Session Security Plan: Auth.js Credentials is JWT-only (no revocation); move to own DB-session module + Argon2id | https://claude.ai/artifact/QL1DDEEN6QERM6GsZP4a8h |
| 2026-10-12 | david-schwartzman | change | Overview no longer says "last spec"; proxy cookie refresh goes through `refreshSessionCookie` in `src/lib/auth/cookie.ts` (no direct cookie writes); AC6/AC8 use app-foundation's `utility` slot; AC11 adds the old-cookie-after-logout check handed over by signup-login; AC12 added for the Max-Age refresh; T3/T9/T11 updated — PR #12 review | https://github.com/david-schwartzman/Stride/pull/12 |
| 2026-10-12 | david-schwartzman | change | AC1: whole-segment prefix matching (`/accounting` isn't protected); Technical Approach: neutral `<Suspense>` header fallback instead of the signed-out header, stale-cookie wording corrected (re-sent by AC12, cleared by the next auth action, not expired); references.md records the `refreshSessionCookie` edit to signup-login's `cookie.ts`; T2/T9/T11 updated — PR #12 review (2nd round) | https://github.com/david-schwartzman/Stride/pull/12 |
| 2026-10-13 | david-schwartzman | change | Backend moved to a separate NestJS API: AC7 logout POSTs to `/api/auth/logout`; AC9/AC10 validate through `GET /auth/me` and add the API `AuthGuard`; callback-url and session-cookie helpers move to `packages/shared`; return-to handled by the API auth endpoints; Covers updated; tasks T1/T3/T4/T6/T8/T9/T11 reworded, T13–T14 added — tech-lead decision for a clear frontend / backend split | softwareos/products/stride/architecture.md |
| 2026-10-13 | david-schwartzman | revised | PR review: the `AuthGuard` and `GET /auth/me` belong to `auth-api-migration`, so T13–T14 are dropped (they were added in the same PR and never shipped), AC9 and the Technical Approach rely on it, and `auth.guard.ts` leaves Covers. Covers uses `apps/web/src/...`; the guard file is shared with `api-foundation`'s `/api` rewrite | https://github.com/david-schwartzman/Stride/pull/21 |
| 2026-10-15 | david-schwartzman | change | `standards.md` (global/auth-security copy): a missing or different `Origin` gets 401, not 403 — tech lead decision: both gatekeeper checks answer 401 | ../../../../../../standards/global/auth-security.md |
| 2026-10-15 | david-schwartzman | revised | Covers: the e2e entry gets the `apps/web/` prefix like the other web paths (the e2e folder moved with the web app in api-foundation) — api-foundation review | — |
| 2026-10-15 | david-schwartzman | change | AC12 and T3: the cookie name rule lives today in `apps/api/src/auth/session-cookie.ts`; this spec moves it into `packages/shared/src/session-cookie.ts` and the API imports it; the proxy detects whichever of the two cookie names is present and never derives it from the web's `NODE_ENV`; Technical Approach matches. Overview: api-foundation and auth-api-migration are no longer candidates, and it points at the API auth module and `POST /auth/logout` instead of `src/lib/auth/` and `signOutAction` — auth-api-migration final review (N4, N10) | ../2026-10-13-auth-api-migration/spec.md |
