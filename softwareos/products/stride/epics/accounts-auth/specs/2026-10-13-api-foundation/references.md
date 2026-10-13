# References for API Foundation

## Related Specs

- **[Related]** [2026-10-08-app-foundation](../2026-10-08-app-foundation/spec.md) — overlaps on `package.json`, `playwright.config.ts`, `.github/workflows/**` and `prisma/schema.prisma` (strong matches in the Step 4 pre-flight). Kept separate because app-foundation is QA-passed and done. This spec restructures those files for the monorepo (the schema moves to `apps/api/prisma/`), and app-foundation's Covers are updated through `/spec-changes` after this ships (T28). This spec also edits `next.config.ts` (the `/api` rewrite) and moves `vercel.json` as wiring edits, without claiming them.
- **[Related]** [2026-10-08-signup-login](../2026-10-08-signup-login/spec.md) — PR #20. The files it adds move into `apps/web` (or, for its migration, `apps/api/prisma/`): `src/lib/auth/**`, `src/features/auth/**`, `src/instrumentation.ts`, `src/lib/request-ip.ts`, `prisma/migrations/*_init_auth`. Ownership stays with signup-login. Its auth code is the temporary Prisma-in-web exception (AC6), and candidate `auth-api-migration` removes it.
- **[Related]** [2026-10-11-protected-routes](../2026-10-11-protected-routes/spec.md), [2026-10-11-session-management](../2026-10-11-session-management/spec.md), [2026-10-11-auth-event-logging](../2026-10-11-auth-event-logging/spec.md) — their Covers already point into `apps/api/...` and `packages/shared/...`. They build on the scaffold, `PrismaService` and `apps/api/src/common/` from this spec. auth-event-logging's AC6 depends on this spec's `getClientIp` (AC9).

## Upstream Meeting

None. The decision is recorded in `softwareos/products/stride/architecture.md` (2026-10-13) and PR #21.

## Similar Implementations

Greenfield for NestJS. The references are the current single-app configs that this spec restructures, mapped on 2026-10-13.

### Root `package.json`

- **Location:** `package.json`
- **Relevance:** AC1, AC5.
- **Key patterns:**
  - Scripts are `dev`/`build`/`start` (next), `lint` (`eslint && prettier --check .`), `typecheck` (`next typegen && tsc --noEmit`), `test` (`vitest run`), `test:e2e`, `db:migrate`, `db:generate`, and `postinstall: prisma generate`.
  - No `workspaces`, no `engines`. Node 24 is pinned only in CI.
  - PR #20 adds `@node-rs/argon2`, `@oslojs/crypto`, `@oslojs/encoding`.

### Vercel build

- **Location:** `vercel.json`
- **Relevance:** AC5, AC12.
- **Key patterns:** `framework: nextjs`; `buildCommand` is `DIRECT_URL="${DIRECT_URL:-$DATABASE_URL_UNPOOLED}" prisma migrate deploy && next build`. The migrate half moves to the API project.

### CI

- **Location:** `.github/workflows/ci.yml`
- **Relevance:** AC11.
- **Key patterns:**
  - One job (Node 24, npm cache): `npm ci` → lint → typecheck → test → playwright install → build → test:e2e.
  - PR #20 adds a `postgres:16` service, the env vars `DATABASE_URL`/`DIRECT_URL`/`TEST_DATABASE_URL`/`PASSWORD_PEPPER`, and an `npx prisma migrate deploy` step after install.

### Test configs

- **Location:** `playwright.config.ts`, `vitest.config.ts`, `vitest.setup.ts`
- **Relevance:** AC2, AC11.
- **Key patterns:**
  - Playwright: `testDir: ./e2e`, one `webServer` on :3000 (`npm run start` in CI; build + start locally).
  - Vitest: `include: src/**/*.test.{ts,tsx}`, jsdom, `vite-tsconfig-paths`. These paths are relative to the config, so they move with it.
  - `src/lib/auth/session.db.test.ts` and `e2e/auth.spec.ts` (PR #20) run only when `TEST_DATABASE_URL` is set.

### TypeScript, lint, ignore files

- **Location:** `tsconfig.json`, `eslint.config.mjs`, `.prettierignore`, `.gitignore`
- **Relevance:** AC1, AC6.
- **Key patterns:**
  - `@/*` → `./src/*` (relative, moves with the config). Root `include: **/*.ts` would sweep in `apps/api`, hence one tsconfig per app.
  - ESLint uses Next presets and ignores `stride-design/**`, `.claude/**`.
  - `.gitignore` uses root-anchored entries (`/.next/`, `/node_modules`, `/test-results/` …) that won't match inside `apps/*`.

### Prisma client and PR #20 server files

- **Location:**
  - `src/lib/db.ts`
  - from PR #20: `src/instrumentation.ts`, `src/lib/request-ip.ts`, `src/lib/auth/**`, `prisma/migrations/*_init_auth`
- **Relevance:** AC5, AC6, AC9.
- **Key patterns:**
  - `db.ts` is a `globalThis`-cached `PrismaClient`.
  - On PR #20, `db` is imported by `src/features/auth/actions.ts`, `src/lib/auth/session.ts` and `src/lib/auth/throttle.ts`, and mocked in their tests. These are exactly the files AC6 allows.
  - `instrumentation.ts` checks the pepper at boot. It stays in web until `auth-api-migration`.
  - `request-ip.ts` trusts only `x-real-ip`, and `ipThrottleBucket` buckets IPv6 per /64 (#20 review). That's right on the web project, where the temporary auth code still runs, but across the rewrite the API would see the web's egress IP. So the web proxy forwards the IP as `x-stride-client-ip` with the proxy secret (PR #21 review), and the API's `getClientIp(req)` reads only that.
- **No path tricks:** nothing in `src`, `e2e` or the configs uses `process.cwd`, `__dirname` or absolute paths. `stride-design/` is referenced only in comments and lint/format ignores.

## Decisions

- **Temporary exception over a big-bang move:** the user chose to land the monorepo and API first, keeping auth's Prisma use inside web behind a lint rule (AC6), rather than merge this spec with `auth-api-migration`.
- **Vitest for the API** (with `unplugin-swc`), not Nest's default Jest, per the tech-stack standard.
- **One root `npm run dev`** via `concurrently`.
- **A missing `Origin` header on state-changing requests is rejected** (AC8). `Origin` is compared with `https://` + the secret-verified `x-stride-forwarded-host`, not a `WEB_ORIGIN` env var (PR #21 review).
- **Security review is a required task (T32)** even in setup mode, because AC8 and AC9 guard later auth work.

## Follow-ups (not in this spec)

- `.claude/` tooling that assumes one app: `.claude/commands/softwareos/verify.md`, `code-review.md`, `hotfix.md`, `spec-of.md`, `.claude/agents/code-reviewer.md`, `.claude/skills/project-audit/*`.
