# Standards for Session Management

The following standards apply to this work.

---

## global/auth-security

# Auth Security

Rules for any code that knows who the user is. The design behind them is in `softwareos/products/stride/architecture.md` (Auth module).

## Who the user is

- Only the API's auth module (`apps/api/src/auth/`) touches session tokens, password hashes and creates or deletes the session cookie. Other API code uses its `AuthGuard` and current-user decorator; the web app uses `getCurrentSession()` (calls `GET /auth/me`) or `requireUser()` (`src/features/session/require-user.ts`).
- Every API endpoint that changes data or returns private data runs the `AuthGuard`. That is the authorization layer. The web's `requireUser()` and proxy/middleware only decide what to render or where to redirect; they are not authorization.
- The user ID always comes from the session. Never accept a `userId` from the client.
- Scope every private query by the session user (`where: { id, userId: user.id }`). An object the user doesn't own returns 404, not 403.

## Sessions and passwords

- Create a **new** session token at login, sign-up and password change. Never reuse a token that arrived with the request.
- Store only `sha256(token)` server-side; the raw token lives only in the HttpOnly `__Host-stride_session` cookie (never `localStorage`).
- Hash passwords with Argon2id + pepper via the API auth module's password service. Never hash on the client or in `apps/web`.

## Requests

- GET never changes state. Every change, including logout, is a POST (or DELETE) to `/api/*`.
- Redirect targets taken from input (`next`, `callbackUrl`) must be same-origin relative paths; otherwise fall back to `/`.
- The API checks the `Origin` header on every state-changing request (one global Nest guard/middleware), and serves the browser only through the same-origin `/api` rewrite — no CORS.

## Secrets and logs

- Secrets (`DATABASE_URL`, `PASSWORD_PEPPER`, `GUEST_CART_SECRET`, `CRON_SECRET`) live in the API project's env vars with a different value per environment — never on the web project and never in a `NEXT_PUBLIC_` variable.
- Never log passwords, session tokens, cookies, reset links or raw request bodies from auth endpoints. Users see generic errors; details go to logs only.

---

## global/tech-stack

# Tech Stack

## Frontend

- Next.js (App Router) with React and TypeScript
- Tailwind CSS for styling
- `next/image` for optimized product images

## Backend

- Separate NestJS API (`apps/api`) in the same npm-workspaces monorepo as the Next.js frontend (`apps/web`); shared Zod schemas and types in `packages/shared`
- **Boundary rule:** `apps/web` never imports Prisma, `@node-rs/argon2` or any secret. All data goes through the API. If a page needs data that no endpoint returns, add an endpoint
- The browser reaches the API only through the same-origin `/api/*` rewrite; Server Components call it server-to-server at `API_URL`
- Server Components load data through the API; client forms send writes to `/api/*` — no Server Actions for data
- Zod for input validation on both client and server, from `packages/shared`

## Auth

- In-house auth module in the API (`apps/api/src/auth/`) with email + password — no auth library
- Opaque database sessions: random token in an HttpOnly `__Host-stride_session` cookie, only its SHA-256 hash stored in Postgres
- Passwords hashed with Argon2id + per-user salt + server-side pepper (`@node-rs/argon2`)
- Rules for using it: `standards/global/auth-security.md`

## Database

- PostgreSQL hosted on Neon (serverless Postgres), connected to the API project only
- Prisma 6 (in `apps/api`) ORM (pinned major; Prisma 7 moves `directUrl` to `prisma.config.ts` and needs a driver adapter) with migrations and a seed script for the product catalog
  - Catalog content lives in one shared catalog data file, imported by both the seed script and the production catalog load
  - Neon needs two connection strings: pooled `DATABASE_URL` for the API at runtime, and unpooled `DIRECT_URL` (`directUrl` in `schema.prisma`) for `prisma migrate`
  - Migrations stay backward-compatible with the previous deploy (expand → contract), so a Vercel rollback (of either project) never needs a database rollback
- Neon branch per preview deployment: each PR preview gets its own database branch, forked from the `develop` database branch, so preview data and migrations stay isolated
  - The API project's CI/preview build runs `prisma migrate deploy` then the seed script against that preview's branch
  - Production runs migrations only, never the seed script. The seed script refuses to run against the production database.
  - Exception: production catalog content is loaded by a dedicated, idempotent catalog load (upserts keyed by slug) that reads the shared catalog data file. It loads catalog data only, never test users, orders or other fixture data.
  - The preview branch is deleted when the PR closes

## Testing

- Vitest + React Testing Library for unit/component tests
- Playwright for end-to-end tests of the shopping flow

## Other

- Vercel hosting: two projects (web, API), each with preview deployments per PR; a web preview points at the API preview from the same commit
- GitHub Actions CI: lint, typecheck, tests on every PR
- Product images stored in the repo under `/public`
- Payment is mocked (no real payment provider)
- Figma as design source of truth (via MCP); Google Stitch for UI generation
- TypeScript strict mode; ESLint + Prettier
- Server-render by default; client components only where interaction requires it

---

## global/git-workflow

# Git Workflow

## Base branch

Branch off `develop` and open every PR against `develop`. `main` is not a PR target.

## Branch naming

One branch per spec, named from the SoftwareOS slugs (no date prefixes):

```
feat/<epic-slug>/<spec-slug>          # spec work — the canonical branch
feat/<epic-slug>/<spec-slug>--t<id>   # parallel work on one spec, split by task
hotfix/<epic-slug>/<bug-slug>         # bug fixes
chore/<slug>                          # everything else
```

- The canonical branch is recorded in the spec's `tasks.md` `> Branch:` line. To map a branch to a spec: match that line first; fall back to suffix-matching `<spec-slug>` against `feat/*/`.
- Slugs are load-bearing — never rename an epic or spec after branches exist.
- Never commit on `develop` or `main`. Branch first.

## Commits

Conventional-commit-ish titles, scoped to the epic:

```
feat(<epic-slug>): add password reset endpoint
fix(<epic-slug>): handle expired reset tokens
chore: bump CI node version
```

- Small, focused commits. Reference task IDs in the body when useful (`T3`, `T4.1`).
- **Never `git commit --no-verify`.** Failing hooks mean fix the cause, not skip the check.
- No force pushes to the default branch.

## Pull requests

- Open PRs with the **pr** skill — it runs verification, builds the title (`feat(<epic-slug>): <spec title>` / `fix(<epic-slug>): <bug title>`) and body from the spec, and writes the PR URL back to `tasks.md`.
- Tasks incomplete → open as draft.

## Production mode

When `softwareos/config.yml` has `mode: production`, the workflow tightens:

- **Git itself is never gated.** Commit and push as usual — pushing is how CI runs and how a branch gets reviewed, so blocking it would obstruct the verification the mode is asking for. The gates live in the tools that can actually check something.
- **A PR needs a passing `qa-report.md` and a recorded `> Reviewed:` line** (written by `/code-review`) before the pr skill will open it. A draft PR is for incomplete work, not for skipping verification.
- **Unfixed HIGH or CRITICAL review findings block the merge**, rather than being advice.

`/go-production` makes this transition and records any waivers; `/go-production --revert` goes back. Neither is a quiet config edit — both leave an entry in `softwareos/production-readiness.md`.
