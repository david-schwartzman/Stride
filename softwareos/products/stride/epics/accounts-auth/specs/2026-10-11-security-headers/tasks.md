# Tasks — Security Headers

> Epic: accounts-auth
> Spec: 2026-10-11-security-headers
> Branch: feat/accounts-auth/security-headers

## Tests first (TDD)

- [ ] T1 Write failing Vitest tables: src/lib/security-headers.test.ts — buildCsp per env (prod exact string, dev adds 'unsafe-eval', preview adds exactly the AC7 sources, prod/local never contain any of them), securityHeaders() exact list incl. HSTS max-age=604800 (AC1, AC2, AC6, AC7); src/lib/private-paths.test.ts — isPrivatePath matrix (/account, /account/orders/x, /checkout?x, /login, /signup → true; /, /accounting, /products/x → false) (AC4, AC8) (testing skill)
- [ ] T2 Write failing Playwright e2e/security-headers.spec.ts: AC1 headers on /, a /_next/static asset, a /public file, /login, and the signed-out /account 307 redirect, and no X-Powered-By; zero CSP violations on /, /login, /signup; sign-up → logout → login under CSP; Cache-Control private+no-store on /login, /signup, /account signed-out (307) and signed-in (AC1, AC3, AC4, AC8) (testing skill)

## Header module + wiring

- [ ] T3 Implement src/lib/security-headers.ts with no imports (buildCsp, securityHeaders, HSTS_MAX_AGE, PRIVATE_CACHE_CONTROL) and src/lib/private-paths.ts (isPrivatePath reusing PROTECTED_PREFIXES from src/features/session/guard.ts) (AC1, AC2, AC4, AC6, AC7)
- [ ] T4 Wire into next.config.ts (app-foundation file): headers() → [{ source: "/:path*", headers: securityHeaders(env) }] via relative import of security-headers.ts only (never private-paths.ts); poweredByHeader: false (AC1, AC5)
- [ ] T5 Edit src/proxy.ts / src/middleware.ts (protected-routes file): set Cache-Control: PRIVATE_CACHE_CONTROL on next() and redirect responses when isPrivatePath(pathname); if T2 shows config headers missing on the 307, also copy securityHeaders(env) onto the redirect (AC1, AC4)
- [ ] T6 Check `next build` output that / is still static/PPR (AC5), and that `next dev` Fast Refresh works under the dev CSP (AC6)

## Verification

- [ ] T7 Run QA against acceptance criteria (qa skill)
