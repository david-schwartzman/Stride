# Tasks — Protected Routes & Session Header

> Epic: accounts-auth
> Spec: 2026-10-11-protected-routes
> Branch: feat/accounts-auth/protected-routes

## Guard & safe redirect

- [ ] T1 Confirm installed Next.js major (proxy.ts on 16+, middleware.ts on 15); add src/lib/callback-url.ts (safeCallbackUrl, buildLoginUrl)
- [ ] T2 Add src/features/session/guard.ts (pure guard() + PROTECTED_PREFIXES)
- [ ] T3 Add src/proxy.ts (or src/middleware.ts): cookie-presence check (no DB, no auth library) calling guard(); matcher for all page routes excluding static files; redirect only PROTECTED_PREFIXES; re-send session cookie Max-Age on GET
- [ ] T4 Add src/features/session/require-user.ts (requireUser(path) → getCurrentSession() user or redirect to buildLoginUrl)

## Return-to wiring (signup-login files)

- [ ] T5 /login + /signup pages: read and sanitise searchParams.callbackUrl, redirect signed-in users to it, pass hidden callbackUrl to forms, carry it on the cross-links
- [ ] T6 loginAction / signupAction in src/features/auth/actions.ts: re-sanitise formData callbackUrl server-side, redirect(safe) instead of "/"
- [ ] T7 Add src/features/session/LoginBanner.tsx (checkout status banner per Login.dc.html) and render it on /login

## Session header

- [ ] T8 Add src/features/session/LogoutButton.tsx (form → signOutAction, no-JS, utility-link style)
- [ ] T9 Add src/features/session/HeaderSession.tsx (getCurrentSession() → accountName, accountHref, utility links); wire it into src/app/layout.tsx inside <Suspense> with a signed-out fallback; Log out in the mobile drawer
- [ ] T10 Add throwaway src/app/account/page.tsx placeholder using requireUser("/account") (unclaimed; account-wishlist replaces it)

## Verification

- [ ] T11 Write tests first (testing skill): Vitest table for safeCallbackUrl (//, /\, scheme, javascript:, encoded, /login loop, length cap, query preserved); guard() matrix (protected vs public paths, sub-paths, cookie present/absent); proxy cookie Max-Age refresh on GET; requireUser redirect incl. revoked/expired/tampered token with cookie present; login/signup actions honour + re-sanitise callbackUrl; RTL for HeaderSession signed-in/out + LoginBanner visibility; Playwright e2e/protected-routes.spec.ts (sign up → header log out → /account → login → back on /account; /checkout banner; //evil.com → /; old cookie copied before logout → /account redirects to login)
- [ ] T12 Run QA against acceptance criteria (qa skill)
