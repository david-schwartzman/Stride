# Tasks — Security Headers

> Epic: accounts-auth
> Spec: 2026-10-11-security-headers
> Branch: feat/accounts-auth/security-headers

## Tests first (TDD)

- [ ] T1 Write failing Vitest table in src/lib/security-headers.test.ts: buildCsp per env (prod exact string, dev adds 'unsafe-eval', preview adds vercel.live, prod/local never do), securityHeaders() exact list (AC1), isPrivatePath matrix (/account, /account/orders/x, /checkout?x, /login, /signup → true; /, /accounting, /products/x → false) (testing skill)
- [ ] T2 Write failing Playwright e2e/security-headers.spec.ts: AC1 headers on /, a /_next/static asset, a /public file, /login, and no X-Powered-By; zero CSP violations on /, /login, /signup; sign-up → logout → login under CSP; Cache-Control private+no-store on /login, /signup, /account signed-out (307) and signed-in (testing skill)

## Header module + wiring

- [ ] T3 Implement src/lib/security-headers.ts (buildCsp, securityHeaders, PRIVATE_CACHE_CONTROL, isPrivatePath reusing PROTECTED_PREFIXES from src/features/session/guard.ts)
- [ ] T4 Wire into next.config.ts (app-foundation file): headers() → [{ source: "/:path*", headers: securityHeaders(env) }] via relative import; poweredByHeader: false
- [ ] T5 Edit src/proxy.ts / src/middleware.ts (protected-routes file): set Cache-Control: PRIVATE_CACHE_CONTROL on next() and redirect responses when isPrivatePath(pathname)
- [ ] T6 Check `next build` output that / is still static/PPR (AC5), and that `next dev` Fast Refresh works under the dev CSP (AC6)

## Verification

- [ ] T7 Run QA against acceptance criteria (qa skill)
