# References for Auth API Migration

## Related Specs

- **[Related]** [2026-10-08-signup-login](../2026-10-08-signup-login/spec.md): this spec moves its `src/lib/auth/**`, the server side of `src/features/auth/**` and `src/instrumentation.ts` into the API. Kept separate because signup-login is the shipped behaviour contract and this is a behaviour-preserving relocation. T28 hands the paths over via `/spec-changes`.
- **[Related]** [2026-10-08-app-foundation](../2026-10-08-app-foundation/spec.md): this spec deletes its `src/lib/db.ts`. Kept separate because it's one file of a broad scaffold spec; T28 drops it from Covers.
- **[Related]** [2026-10-13-api-foundation](../2026-10-13-api-foundation/spec.md): this spec removes its AC6 temporary Prisma-in-web exception. It also makes wiring edits to api-foundation files: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/web/eslint.config.mjs`, `apps/web/src/config/eslint-db-imports.test.ts`, `apps/web/playwright.config.ts` and both `.env.example` files.
- **[Related]** [2026-10-11-protected-routes](../2026-10-11-protected-routes/spec.md): consumes this spec's `AuthGuard`, `GET /auth/me` and logout's 303. It owns `callbackUrl`, `apps/web/src/features/session/**` and `packages/shared/src/session-cookie.ts`; this spec doesn't touch them.

## Upstream Meeting

None (no meetings folder). The planning decisions it relied on: build this only after api-foundation is merged (it needs the monorepo and the API), and the session cookie keeps signup-login's name and flags, now set by the API through the `/api` rewrite and checked in e2e (AC5, AC14).

## Similar Implementations

### Current web auth

- **Location:** `apps/web/src/lib/auth/**`, `apps/web/src/features/auth/**`
- **Relevance:** the logic and tests being ported.
- **Key patterns:** session and throttle services over a Prisma-shaped fake DB (`lib/auth/testing/fake-db.ts`); `useActionState` forms with `AuthFormState`.

### api-foundation Nest patterns

- **Location:** `apps/api/src/health/`, `apps/api/src/common/*.middleware.ts`, `apps/api/src/prisma/`
- **Relevance:** the existing module, test and middleware style in the API.
- **Key patterns:** controllers tested by direct instantiation with a mocked `PrismaService`; middleware tested with hand-built `req`/`res`; `getClientIp(req)` for the trusted client IP.

### apiFetch

- **Location:** `apps/web/src/lib/api-client.ts`
- **Relevance:** the server-side path `RedirectIfSignedIn` uses to call `GET /auth/me`.
- **Key patterns:** forwards the trusted proxy headers and the incoming `Cookie`. It doesn't relay `Set-Cookie` back to the browser.

### Shared schemas

- **Location:** `packages/shared/src/health.ts`, `packages/shared/src/index.ts`
- **Relevance:** the pattern for shared zod request/response schemas. The auth DTOs go in `src/auth/`.
- **Key patterns:** a zod schema plus its inferred type, re-exported from `index.ts`, built to CommonJS `dist`.

### Database import rule

- **Location:** `apps/web/eslint.config.mjs`
- **Relevance:** the `no-restricted-imports` rule and the allowlist this spec removes (AC11).
