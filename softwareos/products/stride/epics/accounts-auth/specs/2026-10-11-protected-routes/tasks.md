# Tasks — Protected Routes & Session Header

> Epic: accounts-auth
> Spec: 2026-10-11-protected-routes
> Branch: feat/accounts-auth/protected-routes

## Guard & safe redirect

- [ ] T1 Confirm installed Next.js major (proxy.ts on 16+, middleware.ts on 15); add packages/shared/src/callback-url.ts (safeCallbackUrl, buildLoginUrl)
- [ ] T2 Add src/features/session/guard.ts (pure guard() + PROTECTED_PREFIXES, whole-segment matching per AC1)
- [ ] T3 Add src/proxy.ts (or src/middleware.ts): cookie-presence check (no DB, no auth library) calling guard(); matcher for all page routes excluding static files; redirect only PROTECTED_PREFIXES; on GET with the cookie call refreshSessionCookie(response, token) from packages/shared/src/session-cookie.ts (cookie name + attributes shared with the API; no secrets, no Prisma/Argon2) — AC12
- [ ] T4 Add src/features/session/require-user.ts (requireUser(path) → getCurrentSession() calls GET /auth/me at API_URL with the cookie forwarded → user, or on 401 redirect to buildLoginUrl)

## Return-to wiring (signup-login files)

- [ ] T5 /login + /signup pages: read and sanitise searchParams.callbackUrl, redirect signed-in users to it, pass hidden callbackUrl to forms, carry it on the cross-links
- [ ] T6 API POST /auth/login and /auth/signup (apps/api auth module): re-sanitise the body's callbackUrl in the API and return it as the redirect target; the forms navigate to it instead of "/"
- [ ] T7 Add src/features/session/LoginBanner.tsx (checkout status banner per Login.dc.html) and render it on /login

## Session header

- [ ] T8 Add src/features/session/LogoutButton.tsx (form method=post action=/api/auth/logout → API 303 to /, no-JS, utility-link style)
- [ ] T9 Add src/features/session/HeaderSession.tsx (getCurrentSession() via GET /auth/me → accountName, accountHref, and when signed in a utility node "My orders" + LogoutButton); wire it into src/app/layout.tsx inside <Suspense> with a neutral fallback (no account dot, aria-hidden utility placeholder); Log out in the mobile drawer
- [ ] T10 Add throwaway src/app/account/page.tsx placeholder using requireUser("/account") (unclaimed; account-wishlist replaces it)

## Verification

- [ ] T11 Write tests first (testing skill): Vitest table for safeCallbackUrl (//, /\, scheme, javascript:, encoded, /login loop, length cap, query preserved); guard() matrix (protected vs public paths, sub-paths, /accounting and /wishlists not protected, cookie present/absent); refreshSessionCookie attributes + proxy refresh on GET only with cookie (AC12); requireUser redirect incl. revoked/expired/tampered token with cookie present; login/signup endpoints honour + re-sanitise callbackUrl; RTL for HeaderSession signed-in/out, the Suspense fallback showing neither Sign up/Log in nor Log out, and LoginBanner visibility; Playwright e2e/protected-routes.spec.ts (sign up → header log out → /account → login → back on /account; /checkout banner; //evil.com → /; old cookie copied before logout → /account redirects to login)
- [ ] T12 Run QA against acceptance criteria (qa skill)

## API guard (added 2026-10-13, NestJS backend)

- [ ] T13 Add apps/api/src/auth/auth.guard.ts (Nest AuthGuard: session cookie → session service → request user, 401 otherwise) and GET /auth/me using it — AC9, AC10
- [ ] T14 Write tests first (testing skill) for the AuthGuard and GET /auth/me: valid, missing, expired, revoked and tampered cookie; no user data in the 401 body
