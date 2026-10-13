# Tasks — Sign-up & Login

> Epic: accounts-auth
> Spec: 2026-10-08-signup-login
> Branch: feat/accounts-auth/signup-login

## Data & passwords

- [x] T1 Add User (incl. pepperVersion), Session and AuthAttempt models to prisma/schema.prisma and generate migration prisma/migrations/<ts>_init_auth/
- [x] T2 Add @node-rs/argon2 (exact pin) and src/lib/auth/password.ts (hashPassword / verifyPassword / verifyDummy; Argon2id m=19456 t=2 p=1, secret = PASSWORD_PEPPER via getPepper(), which throws when the pepper is missing, empty or decodes to < 32 bytes); src/instrumentation.ts runs the same check at server start

## Auth module

- [ ] T15 Add @oslojs/crypto + @oslojs/encoding (exact pins) and src/lib/auth/session.ts (generateSessionToken, hashToken, createSession, validateSessionToken with 30d sliding / renew under 15d / 90d cap, invalidateSession, invalidateAllSessions)
- [ ] T16 Add src/lib/auth/cookie.ts (set/delete with exact attributes; __Host-stride_session in production, stride_session in dev) and src/lib/auth/current.ts (getCurrentSession wrapped in React cache())
- [ ] T17 Add src/lib/request-ip.ts (`getClientIp(headers)`: `x-real-ip` validated with `net.isIP()`, else null; never `x-forwarded-for`) and src/lib/auth/throttle.ts (AuthAttempt-based checkLoginThrottle, recordLoginFailure, clearLoginFailures, checkSignupThrottle; each normalises the email itself via normalizeEmail (trim + lowercase) from src/lib/auth/email.ts, also used by T5's schemas; exact limits + back-off table per AC14 as an exported const; IP from `getClientIp` only, per-IP checks skipped when it's null)
- [ ] T18 Spike before building forms: deploy a throwaway route to a Vercel preview that hashes + verifies a password with @node-rs/argon2 (pepper from env) and sets/reads the session cookie; confirm the native module loads in the serverless function, then remove the route

## Auth module tests (before T5)

- [~] T19 Write Vitest tests test-first for the auth module (testing skill), passing before T5 starts: password.ts (hash, verify, wrong password, wrong pepper, verifyDummy, missing / empty / < 32-byte pepper throws); session.ts (create, validate, sliding renewal, 90-day cap, expired deleted, invalidate, invalidateAll, only hash stored, old token rejected after invalidateSession — AC16); throttle.ts (each back-off step delay(5..9+), per-IP 30/15 min block, signup 10/60 min limit, clear on success, unknown-email failures counted per email and per IP, 5 failures as `a@x.com` then ` A@X.com ` is refused, a refused attempt isn't recorded as a failure, per-IP checks skipped when the IP is null); request-ip.ts (valid IPv4/IPv6 `x-real-ip` returned; missing, empty or garbage → null; a spoofed `x-forwarded-for` is ignored)

## Auth.js

- [-] T3 Add next-auth v5 (exact pin); src/auth.config.ts (edge-safe: jwt strategy, pages.signIn, jwt/session callbacks copying id/email/name) (cancelled — Auth.js replaced by in-house src/lib/auth/, see Changelog 2026-10-11)
- [-] T4 Add src/auth.ts (Credentials provider, authorize via loginSchema + verifyPassword) and src/app/api/auth/[...nextauth]/route.ts (cancelled — Auth.js replaced by in-house src/lib/auth/, see Changelog 2026-10-11)
- [-] T4.1 Add src/features/auth/next-auth.d.ts augmenting Session["user"] with id (cancelled — Auth.js replaced by in-house src/lib/auth/, see Changelog 2026-10-11)

## Validation, actions & hook

- [ ] T5 Add src/features/auth/schemas.ts (signupSchema, loginSchema: email via normalizeEmail, password 12–128, name required)
- [ ] T6 Add src/features/auth/hooks.ts (no-op onSignedIn) and runOnSignedIn wrapper (try/catch, log userId + error only)
- [ ] T7 Implement signupAction in src/features/auth/actions.ts (checkSignupThrottle, safeParse, hashPassword, create user, P2002 → email error, new token + createSession + set cookie, runOnSignedIn, redirect /)
- [ ] T8 Implement loginAction (safeParse first, then checkLoginThrottle on the normalised email → "Too many attempts" error, lookup by email, verifyDummy + recordLoginFailure when missing, verifyPassword, recordLoginFailure → password error, clearLoginFailures, new token + createSession + set cookie, runOnSignedIn, redirect /) and signOutAction (invalidateSession, delete cookie, redirect /)

## Pages & forms

- [ ] T9 Add src/app/(auth)/layout.tsx split panel per Login/Signup designs (side panel hidden at mobile)
- [ ] T10 Build src/features/auth/SignupForm.tsx (useActionState, on-blur Zod, Input errors, pending Button, autoComplete) and src/app/(auth)/signup/page.tsx (redirect / if signed in)
- [ ] T11 Build src/features/auth/LoginForm.tsx and src/app/(auth)/login/page.tsx (same pattern, design copy + links)

## CI

- [ ] T12 Extend .github/workflows/ci.yml: postgres:16 service, DATABASE_URL/DIRECT_URL and test-only PASSWORD_PEPPER env, prisma migrate deploy before e2e

## Verification

- [ ] T13 Write tests first (testing skill), module tests are T19: Vitest for schemas and signup/login/signOut actions (duplicate email, P2002, wrong password, unknown email uses dummy hash, unknown email hits "Too many attempts" after 5 failures like a real one, 5 wrong passwords as `a@x.com` then ` A@X.com ` gets "Too many attempts", too many attempts, signup limit message, new token per login, hook called once, hook throwing still signs in, no password in returned state, signOut deletes the row + clears the cookie); RTL for form error wiring; Playwright e2e sign up → session holds across reload → fresh context log in → session holds (logout e2e is protected-routes T11)
- [ ] T14 Run QA against acceptance criteria (qa skill)
