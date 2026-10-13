# Security Headers

> Epic: ../../epic.md
> Status: shaped
> Branch: feat/accounts-auth/security-headers
> Covers: src/lib/security-headers.ts, src/lib/security-headers.test.ts, src/lib/private-paths.ts, src/lib/private-paths.test.ts, e2e/security-headers.spec.ts

## Overview

Fourth spec of Accounts & Auth, and the first of the tech plan's later candidate specs. The tech plan marks it "required for launch." It adds HTTP security headers to **every route**: catalog and home pages, auth pages, private pages and static assets. It also makes private pages uncacheable. Shoppers see no change.

No success criterion in the brief names headers. This spec serves the brief's goal "A secure session" (product-brief.md:10) and the tech plan's "required for launch" line. It adds no new success criterion to the brief. What each header protects:

- **HSTS** protects the session cookie. After the first visit, the browser refuses plain HTTP to Stride, so a network attacker can't downgrade a visit to HTTP. The `Secure` `__Host-stride_session` cookie is therefore only ever sent over HTTPS.
- **CSP** does not protect the cookie: HttpOnly already keeps it away from JavaScript. The CSP limits what injected script could do while acting as the signed-in user. It can't load scripts from or send data to other origins, can't frame the page, and can't post forms to other origins.
- **Cache-Control: private, no-store** on private pages stops shared caches and the back/forward cache from serving one shopper's HTML to another.
- **frame-ancestors / X-Frame-Options** stop clickjacking. **nosniff, Referrer-Policy and Permissions-Policy** are cheap defaults.

Builds on `app-foundation` (owns `next.config.ts`) and `protected-routes` (owns the proxy and `PROTECTED_PREFIXES`). Both must be merged first. This spec only makes small wiring edits to their files and claims neither.

## Goals & User Stories

- As a shopper, my session can't be stolen by downgrading my connection to HTTP.
- As a shopper on a shared computer, the next person can't see my account, checkout or wishlist pages from a cache or the back button.
- As a shopper, Stride can't be framed by another site to trick me into clicking.
- As a developer, one module defines every security header, and tests fail if a header is dropped or weakened.

## Acceptance Criteria

1. AC1: Every response (pages, redirects, `/_next/static/*`, files in `/public`) carries:
   - `Strict-Transport-Security: max-age=604800; includeSubDomains` (one week at launch; see the HSTS ramp-up below)
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()`
   - `X-Frame-Options: DENY`
   - `Content-Security-Policy` (AC2)

   No response carries `X-Powered-By`.
2. AC2: The production CSP is exactly: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. It has no nonce, no `'unsafe-eval'` and no `vercel.live`.
3. AC3: In Chromium on the production build, `/`, `/login` and `/signup` load with zero CSP violations. Sign-up, login (including the redirect back to `callbackUrl`) and header logout all work under the CSP, and protected-routes' e2e journey still passes.
4. AC4: Responses for `/checkout`, `/account`, `/wishlist` (and sub-paths), `/login` and `/signup` carry a `Cache-Control` with both `private` and `no-store`, signed in or signed out (including the redirect to login). Public pages such as `/` don't get `no-store` from this spec.
5. AC5: The headers don't change how pages render. `/` keeps its static/PPR rendering in `next build` output, and no page reads headers or a nonce.
6. AC6: `next dev` still works (Fast Refresh, error overlay). Only the dev CSP adds `'unsafe-eval'` to `script-src`.
7. AC7: Vercel preview builds (`VERCEL_ENV=preview`) add exactly these sources for Vercel's preview toolbar, on top of the AC2 policy:
   - `script-src https://vercel.live`
   - `style-src https://vercel.live`
   - `img-src https://vercel.live https://vercel.com`
   - `font-src https://vercel.live https://assets.vercel.com`
   - `connect-src https://vercel.live wss://ws-us3.pusher.com`
   - `frame-src https://vercel.live` (a new directive; production has none and falls back to `default-src 'self'`)

   Preview adds no `'unsafe-eval'`. Production and local builds never include any of these origins.
8. AC8: Vitest covers the header builder (AC1, AC2, AC6, AC7 per environment, plus the private-path matrix), and Playwright `e2e/security-headers.spec.ts` covers AC1, AC3 and AC4 against the built app in CI.

## Technical Approach

- **Header module:** `src/lib/security-headers.ts` exports:
  - `buildCsp({ dev, vercelPreview })`: the policy as a joined string.
  - `securityHeaders(env)`: the `{ key, value }[]` list for AC1.
  - `PRIVATE_CACHE_CONTROL = "private, no-store"`.

  It has **no imports at all**. `next.config.ts` loads it, and next.config doesn't resolve `@/` paths, so anything it pulls in transitively must be import-free too. The environment is read once from `NODE_ENV` and `VERCEL_ENV` at build time.
- **Private-path module:** `src/lib/private-paths.ts` exports `isPrivatePath(pathname)`: protected-routes' `PROTECTED_PREFIXES` (imported from `src/features/session/guard.ts`) plus `/login` and `/signup`, matched on segment boundaries so `/accounting` doesn't match. It is a separate file because `guard.ts` imports `packages/shared/src/callback-url.ts`. Only the proxy imports it, and the proxy resolves `@/` normally. `next.config.ts` must never import it.
- **Static headers, via `next.config.ts` `headers()`** (wiring edit to app-foundation's file): `[{ source: "/:path*", headers: securityHeaders(...) }]` plus `poweredByHeader: false`. Use a relative import, not `@/`, because next.config.ts doesn't resolve tsconfig paths. Headers set this way are static config, so they don't force any page to render dynamically (AC5). This is why there are no nonces: per the shaping decision and the tech plan, a nonce CSP would make every page dynamic.
- **Why `'unsafe-inline'` in script-src:** the App Router streams inline `<script>` tags holding the RSC payload, and their contents differ per page. A static hash list can't cover them, and nonces were ruled out. Next's documented no-nonce CSP uses `'unsafe-inline'`. This is a known weakness of this CSP. Everything else is locked down (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and no third-party origins at all, since v1 has none). Escaping React output and Zod-validated input remain the main XSS defence. `style-src 'unsafe-inline'` is needed for `next/image` and `next/font` inline styles.
- **Private-page caching** (wiring edit to protected-routes' proxy): dynamic pages in Next already send a `private, no-store` style Cache-Control, but Next overwrites Cache-Control set in `next.config.ts` for pages, so we don't rely on config. The proxy already runs on every page route. When `isPrivatePath(pathname)` matches, it sets `Cache-Control: PRIVATE_CACHE_CONTROL` on both its `next()` and redirect responses. The e2e test checks what actually reaches the browser (AC4).
- **Headers on proxy redirects (AC1):** the signed-out `/account` 307 comes from the proxy, not from a page. T2 asserts the full AC1 set on it. If that test shows `next.config.ts` headers don't reach proxy-built redirects, the proxy also copies `securityHeaders(env)` onto its redirect response (T5). Either way, the test decides.
- **HSTS ramp-up:** `includeSubDomains`, **no `preload`**, because preload is hard to undo. A long HSTS with `includeSubDomains` is also hard to undo: browsers that have seen it refuse HTTP on every subdomain until it expires. So launch with `max-age=604800` (one week), held in one exported constant, `HSTS_MAX_AGE`. After a week in production with no HTTP-only subdomain problems, raise it to `63072000` (two years) through `/spec-changes`. Browsers ignore HSTS over `http://localhost`, so sending it everywhere is harmless in dev and in Playwright.
- **No `upgrade-insecure-requests`:** HSTS already covers it, every asset is same-origin, and it would interfere with the Playwright run on `http://localhost`.
- **Vercel preview:** when `VERCEL_ENV === "preview"`, add exactly the AC7 sources. They come from Vercel's toolbar CSP docs at shaping time. If Vercel changes its toolbar origins, update AC7 through `/spec-changes`. Unit tests pin the exact preview string and assert production never contains any of them.
- **Tests:**
  - Vitest table for the builder per environment and for `isPrivatePath`.
  - Playwright on the built app: header assertions for `/`, a `/_next/static` asset, a `/public` file, `/login`, and the signed-out `/account` 307 redirect. Capture CSP violations through `console` and `securitypolicyviolation` on `/`, `/login`, `/signup`. Run sign-up → logout → login under the CSP. Check Cache-Control for `/login`, `/signup`, `/account` signed out (the 307) and signed in (the placeholder page).

## Out of Scope

- Nonce- or hash-based strict `script-src`, and Trusted Types (would require dynamic rendering; revisit if the static shell is dropped).
- A CSP reporting endpoint (`report-to`) and report-only rollout.
- HSTS `preload` and the preload list submission.
- Raising HSTS from one week to two years. That's a one-line `/spec-changes` follow-up after a clean week in production.
- COOP / COEP / CORP and other cross-origin isolation headers.
- CORS policy. There are no cross-origin API consumers in v1.
- Third-party origins (analytics, payments, CDNs). There are none in v1. Whichever spec adds one also adds its CSP entry.
- Session management and auth event logging (candidates `session-management`, `auth-event-logging`).

## Standards Applied

- [global/tech-stack](../../../../../../standards/global/tech-stack.md): Next.js App Router on Vercel, server-rendered by default (headers must not force dynamic rendering), Vitest + Playwright.
- [global/auth-security](../../../../../../standards/global/auth-security.md): hardens the HttpOnly `__Host-stride_session` cookie this standard mandates. The proxy edit stays a convenience, not authorization.
- [global/git-workflow](../../../../../../standards/global/git-workflow.md): branch off `develop`, PR to `develop`, `feat(accounts-auth): …` commits.

## Changelog

| Date | Author | Type | Change | Ref |
|---|---|---|---|---|
| 2026-10-11 | david-schwartzman | created | Initial shaping | — |
| 2026-10-12 | david-schwartzman | revised | PR review: `isPrivatePath` moved to `src/lib/private-paths.ts` so next.config's import chain stays import-free; exact preview CSP in AC7; AC1 headers tested on the proxy 307; HSTS ramp-up (one week at launch); `'unsafe-inline'` recorded in tech-plan.md | PR #14 |
| 2026-10-13 | david-schwartzman | revised | PR review: the private-path note points at `packages/shared/src/callback-url.ts`, where protected-routes now puts the helper | https://github.com/david-schwartzman/Stride/pull/21 |
