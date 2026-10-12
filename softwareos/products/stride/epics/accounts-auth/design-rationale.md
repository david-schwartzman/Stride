# Accounts & Auth: Design Rationale

> Epic: [epic.md](epic.md) · Specs: [app-foundation](specs/2026-10-08-app-foundation/spec.md), [signup-login](specs/2026-10-08-signup-login/spec.md) · Later: [protected-routes](specs/2026-10-11-protected-routes/spec.md)
> Written: 2026-10-08

A plain-language explanation of what the first two specs do, why each choice was made, and which alternatives were rejected. Section 5 lists three things that have changed since the stack was chosen. Read those first, because they're the most likely ways to get caught out.

---

## 1. The big picture

**What was built:** two specs, the first two pieces of the "Accounts & Auth" epic for Stride, a small running-gear shop for beginners.

| Spec | In one sentence |
|---|---|
| **app-foundation** | The empty but fully working shell of the app: project setup, database connection, automatic checks on every PR, preview sites, and the shared header and footer. No login yet. |
| **signup-login** | The first real feature: a `User` table, sign-up and log-in pages, the session cookie, and logout. |

**Why split it into two specs?**
- The foundation is something **every** later epic needs (cart, catalog, wishlist). Building it on its own means it gets reviewed and merged once, and everyone builds on it.
- Smaller PRs are easier to review and safer to merge.
- If the risky setup (Neon + Vercel preview databases) breaks, you find out before any login code has been written.

**Rejected: one big "auth" spec.** It would have been one huge PR mixing setup with features, and nothing else could start until all of it was done.

**Rejected: three specs from the start.** The tech plan does list a third spec, `protected-routes` (blocking `/checkout` etc. for logged-out users). It was kept separate on purpose so these two stay small.

**An honest framing:** much of the stack (Next.js, Prisma, Neon, Zod, Vercel) was **already set by the project's tech-stack standard** ([`standards/global/tech-stack.md`](../../../../standards/global/tech-stack.md)). The specs didn't invent those choices. They applied them and made the detailed decisions the standard left open. If someone asks "why Next.js?", the answer is: "It's the project standard, and here's why it fits." (Auth was originally Auth.js + bcrypt as well; on 2026-10-11 it moved to an in-house session module with Argon2id, see §3.2–3.4.)

---

## 2. App Foundation: what it does and why

### 2.1 Next.js (App Router) + TypeScript strict + Tailwind

**What it does:** Next.js is the framework. It handles the pages, the server code and the build. "App Router" is its modern way of organising pages. "Strict" TypeScript catches more mistakes before the code runs.

**Why:**
- One codebase covers both frontend and backend, so there's no separate API server to build and host.
- Pages are **rendered on the server by default**. The browser gets ready HTML, which makes the first screen fast, especially on phones. That matches the mission's "landing to order in under 3 minutes" and mobile goals.
- Tailwind lets the designer's tokens (colours, fonts, radius) become class names like `bg-volt`. The code then matches the design exactly.

**Rejected:**
- **React + separate Express API:** two apps to build, deploy and keep in sync, which is too much for a small shop.
- **Remix / SvelteKit / Astro:** all good options, but the standard says Next.js, and it has the best fit with Vercel hosting.
- **Plain CSS / CSS-in-JS:** harder to map design tokens to code, and CSS-in-JS works poorly with server rendering.

### 2.2 Database: PostgreSQL on Neon, through Prisma

**What it does:** Postgres stores the data. Neon hosts it in the cloud. Prisma is the layer that lets the code read and write data in typed TypeScript instead of raw SQL, and it manages **migrations** (versioned changes to the tables).

**Why:**
- The shop data (users, products, orders, stock per size) is relational, which is exactly what Postgres does well.
- Neon is "serverless": it sleeps when unused, so it's cheap. Its key feature is **branching**: you can copy the database instantly, like a git branch.
- Prisma gives type safety and simple migrations.

**Two connection strings (`DATABASE_URL` + `DIRECT_URL`):**
- On Vercel, the app runs as many short-lived small servers. If each one opened its own database connection, the database would run out of connections. The **pooled** URL goes through a "connection sharer".
- Migrations need a **direct** connection, because the sharer can't handle them. So there are two URLs, one for each job.

**One shared Prisma client (`src/lib/db.ts`):** in development, the app reloads on every file save. Without this, each reload would open a new database client until you hit the connection limit. Caching the client on `globalThis` prevents that.

**Rejected:**
- **MongoDB:** the data is relational (orders link to users and products), and Postgres handles that better.
- **Supabase:** also Postgres, but it bundles its own auth and other services we'd be paying for and not using. Neon's branching is the feature we need.
- **Drizzle instead of Prisma:** lighter and closer to SQL, a reasonable choice. Prisma is the standard and has the more mature migration flow.
- **SQLite:** you couldn't get a separate database per preview the same way, and it's a poor fit for serverless hosting.

### 2.3 A separate database for every PR preview (the "spike")

**What it does:** when a PR is opened, Vercel builds a preview site. The Neon integration creates a **copy of the `develop` database just for that PR** and runs migrations on it. When the PR closes, the copy is deleted.

**Why:**
- Two PRs that change the database can't break each other or the shared dev database.
- Reviewers click a real working link instead of trusting screenshots.
- **The spike (T6.1):** this is the riskiest setup step, so we prove it works with a throwaway PR **before** building any UI. If it fails, we've lost an hour, not a week.

**"Production runs migrations only, never a seed":** the seed script fills the database with fake data. It must never run against real production data.

**Rejected:**
- **One shared preview database:** PRs would clash.
- **No database in previews:** previews would be useless for anything with data.

### 2.4 Automatic checks (CI) on every PR

**What it does:** a GitHub Actions workflow runs lint, typecheck, unit tests (Vitest), a browser test (Playwright) and a build on every PR to `develop`. If any step fails, the PR shows red.

**Why:** bugs get caught before merge, automatically, for everyone. Vitest is fast and works natively with modern tooling. Playwright drives a real browser, which we need to test things like "no horizontal scroll at 375px".

**Rejected:**
- **Jest:** older and slower, with more config needed for modern TypeScript.
- **Cypress:** heavier, and weaker at multiple tabs and multiple browsers. Playwright is now the common default.
- **No database in CI yet:** intentional, because there are no tables yet. signup-login adds one when it needs it.

### 2.5 Design system → code

**What it does:** the designer's tokens ([`stride-design/design-system/tokens.css`](../../../../../stride-design/design-system/tokens.css)) become the Tailwind theme. Only the **Button** and **Input** components are built, plus Header, Footer and a "Skip to content" link.

**Why:**
- The colours and fonts have a single source of truth, the design files. That avoids hand-copied hex codes drifting apart over time.
- **Only Button + Input now:** signup-login needs exactly those. Other components (ProductCard etc.) get built by the spec that first needs them, which avoids building things nobody uses yet.
- **The Header already takes `cartCount` / `accountName` props** (defaulting to empty). Later specs can plug in real values without changing the Header's API.
- **Accessibility built in:** skip link, visible focus ring, touch targets of at least 44px, and errors linked to inputs so screen readers read them. Retrofitting these later is much harder.
- **Fonts via `next/font`:** fonts are self-hosted and preloaded, with no layout jump while they load.

**Rejected:**
- **A component library such as MUI or Chakra:** it would fight the custom brand design.
- **Copying the HTML design files directly:** they're a visual reference, not production code.

### 2.6 Secrets

`.env.example` contains placeholders only. Real `.env` files are git-ignored. `PASSWORD_PEPPER` and `GUEST_CART_SECRET` are listed now so the Vercel environment variables get set once, with a different value per environment.

---

## 3. Sign-up & Login: what it does and why

### 3.1 The flow in simple words

1. The shopper fills in the form. The browser checks it first: is the email valid, is the password at least 12 characters?
2. The form is sent to a **Server Action**, a server function the form calls directly. The server checks everything again.
3. **Sign-up:** create the user with a **hashed** password (never the real one), then log them in.
4. **Log-in:** find the user by email and compare the password against the hash.
5. On success, the server creates a new session (a random token; only its hash is stored in the database), sets the **session cookie** and redirects to `/`.
6. Then it calls `onSignedIn(userId)`, an empty "hook" that the cart team will later use to merge the guest cart into the account.

### 3.2 Auth.js with "Credentials" (email + password)

> Superseded 2026-10-11: Auth.js was replaced by an in-house session module (`src/lib/auth/`), because its Credentials provider only supports JWT sessions, which can't be revoked. The "writing auth ourselves" risk is contained by keeping the module to about 150 lines, following a published pattern (Lucia / The Copenhagen Book) and testing it fully — see [architecture.md](../../architecture.md)

**Why:**
- It's the project standard, it runs inside the app, and it costs nothing.
- It handles the hard, risky parts for us: signing cookies, CSRF protection and session handling.
- Email + password matches the mission's scope. Social login and password reset are explicitly out of v1.

**Rejected:**
- **Clerk / Auth0:** paid external services that hold our user data. Too much for a small v1, and the epic says "no new external services".
- **Writing auth ourselves:** easy to get subtly wrong, and the security risk is high.
- **Better Auth:** see section 5.

### 3.3 JWT sessions instead of database sessions (the main decision made in these specs)

> Superseded 2026-10-11: database sessions replaced JWT. The cookie holds a random 256-bit token; the `Session` table stores only its SHA-256 hash. Logout or a revoke deletes the row and takes effect on the next request. The cost is one indexed lookup per request — see [architecture.md](../../architecture.md)

**What it means:**
- **JWT session:** the user's ID, email and name are stored *inside* the cookie, signed with `AUTH_SECRET` so nobody can fake or edit it. The server just checks the signature, with no database lookup.
- **Database session:** the cookie holds only a random ID, and the server looks it up in a `Session` table on every request.

**Why JWT:**
- **Auth.js's Credentials provider is designed to work with JWT.** Database sessions with Credentials aren't supported out of the box and need workarounds. The tech plan flagged this as an open risk, and this spec closes it.
- It's faster: there's no database lookup on every page view.
- The upcoming `protected-routes` check can run without touching the database.

> Superseded 2026-10-11: no longer true. With database sessions, logout deletes the session row and `invalidateAllSessions(userId)` force-logs-out a user everywhere (PR #10; "sign out of other devices" is the session-management spec). Kept below only as the original reasoning.

**The trade-off (say it before they do):** we **can't force-log-out** one specific user. For example, if a session is stolen, it stays valid until it expires. Another small issue: if the user changes their name, the cookie still shows the old name until they log in again. Both are listed in Out of Scope. For a v1 shop with mock payments, this is acceptable.

### 3.4 Passwords: bcrypt (`bcryptjs`, cost 12)

> Superseded 2026-10-11: passwords are hashed with Argon2id (19 MiB, t=2, p=1) + per-user salt + a server-side pepper (`PASSWORD_PEPPER`) via `@node-rs/argon2`, a prebuilt native module that runs on Vercel, so the native-build concern below no longer applies — see [architecture.md](../../architecture.md)

**What it does:** turns a password into a one-way scrambled "hash". Even if the database leaks, the real passwords aren't in it.

**Why:**
- bcrypt is deliberately **slow**, which makes guessing passwords expensive for attackers. It's also the project standard.
- **Cost 12** is roughly a quarter of a second per hash. That's slow enough to hurt attackers and fast enough that users don't notice.
- **`bcryptjs` (pure JavaScript) instead of `bcrypt` (native C++):** the native version has to be compiled, and that often breaks on Vercel. The pure JS version just works.
- **Only `src/lib/password.ts` touches bcrypt:** one place to check and one place to change.

**Rejected:**
- **Argon2:** technically stronger and the modern recommendation, but it needs native builds, which bring the same Vercel problem. The standard also says bcrypt.
- **SHA-256 / MD5:** far too fast to resist guessing. Never use them for passwords.

### 3.5 Why the password limit is 12–128

- **12 minimum:** above OWASP's floor of 8 and friendlier than NIST's 15 for a password-only login (changed from 8 on 2026-10-11; the design's "At least 8 characters" hint is out of date).
- **128 maximum:** Argon2id has no 72-byte limit like bcrypt; the cap only keeps huge inputs from tying up the hasher.

### 3.6 Zod, with the same rules in the browser and on the server

**Why:**
- The browser check is for **speed and comfort**: the error shows right away, on blur.
- The server check is for **security**: anyone can skip the browser and send a request directly.
- Using **one shared schema file** means the two checks can never disagree.
- Emails are trimmed and lowercased, so `Dana@X.com` and `dana@x.com` count as the same account.

### 3.7 Security details worth knowing

| Detail | Why |
|---|---|
| Same error for "wrong password" and "no such email" | Attackers can't use the login form to find out which emails have accounts. |
| Cookie is `httpOnly` | JavaScript can't read it, so an XSS bug can't steal the session. |
| Cookie is `SameSite=Lax` | Blocks most cross-site request attacks. |
| Cookie is `Secure` in production | Only sent over HTTPS. |
| Database `unique` on email + catching Prisma error `P2002` | Two sign-ups clicked at the exact same moment can't create duplicate accounts. The database is the final judge. |
| Password and session token never sent back to the form or the logs; the database stores only the token's hash | Explicitly tested (AC11, AC12). |
| Button disabled while pending | Prevents double submits. |

### 3.8 Two config files (`auth.config.ts` + `auth.ts`)

> Superseded 2026-10-11: with Auth.js gone there are no config files to split. The proxy only checks that the session cookie is present, so it never loads Prisma or Argon2 — see [architecture.md](../../architecture.md)

**Why:** the route-blocking check in `protected-routes` might run in Next's "edge" runtime, which can't load Prisma or bcrypt. So the lightweight part (session rules) sits in one file, and the database and password part sits in the other. This is the split the Auth.js docs recommend. (Section 5 covers whether it's still needed.)

### 3.9 The `onSignedIn` hook (empty for now)

**Why:** the cart team needs to "merge the guest cart into the account on login". Rather than letting them edit the login code later, we give them **one documented place to plug in**.
- If their code crashes, the error is logged and **login still succeeds**. A cart bug should never lock people out.
- This closes an open risk in the cart-checkout tech plan.

### 3.10 CI uses a plain Postgres container, not a Neon branch

**Why:** the browser test needs a real database. A `postgres:16` container inside GitHub Actions is free and fast, and it needs **no Neon credentials in CI**.

**Rejected: a Neon branch per CI run.** That needs API secrets in CI and adds more moving parts. The foundation spec had planned this, and the change is recorded in [signup-login's `references.md`](specs/2026-10-08-signup-login/references.md).

**Trade-off:** CI runs plain Postgres, not Neon. In practice both are Postgres 16 and behave the same for this code. The preview deploys still test the real Neon setup.

---

## 4. Questions they might ask, with short answers

- **"Can someone brute-force passwords?"** → Failed logins are throttled in Postgres: 5 failures in 15 minutes per email starts a back-off of 1, 2, 4, 8, then 15 minutes; 30 failures per IP in 15 minutes block that IP for 15 minutes; sign-up is capped at 10 per hour per IP. Unknown emails are throttled exactly like real ones, so the throttle doesn't reveal which accounts exist. Argon2id also makes each offline guess expensive. (This used to be a documented v1 gap; closed 2026-10-11.)
- **"Why redirect to `/` instead of back to where they came from?"** → Return-to with `callbackUrl` belongs to `protected-routes`, because it needs a safe-redirect check (an open-redirect risk). Doing it right was moved there on purpose.
- **"Why are there links that 404?"** → The header links point to pages that later epics build. This is documented as not a QA failure.
- **"Why no email verification or password reset?"** → Both are explicitly out of v1 scope in the mission.
- **"How do you log out in the e2e test?"** → signup-login's e2e doesn't log out: it has no logout control, and Playwright can't call a Server Action directly. There, logout and "an old token is rejected" are integration tests. The browser journey (log out with the header button, then check that an old copy of the cookie is rejected) is in `protected-routes`, where the button ships.

---

## 5. Weak spots to fix before someone else finds them

All three are about things that changed after the tech-stack standard was written.

1. > Resolved 2026-10-11: the project pins Prisma 6, so the app-foundation spec works as written — see [standards/global/tech-stack.md](../../../../standards/global/tech-stack.md)

   **Prisma 7 removed `directUrl` from `schema.prisma`.** The connection URL now lives in a new `prisma.config.ts` file, and Prisma Client now needs a "driver adapter" (for Postgres, typically `@prisma/adapter-pg`). The app-foundation spec says to scaffold with current versions **and** to put `directUrl = env("DIRECT_URL")` in the schema. With Prisma 7 that won't work as written.
   - **Fix:** either pin Prisma 6 (simplest, and the spec stays as written), or update AC4 and the Technical Approach for Prisma 7 via `/spec-changes`.

2. > Superseded 2026-10-11: Auth.js is no longer used — see [architecture.md](../../architecture.md)

   **Auth.js is now maintained by the Better Auth team** (announced September 2025). They still ship security fixes for Auth.js but **recommend Better Auth for new projects**.
   - **Defence:** Auth.js is the project standard. It is still maintained for security. Exact-pinning limits surprises. It matches the JWT-only design, which is the use case the Better Auth team themselves list as Auth.js's remaining strength.
   - Expect this question. If the team is open to it, it's a good topic to raise proactively.

3. **Next.js 16 renamed `middleware` to `proxy`, and it now runs on Node.js by default**, not edge.
   - This mostly affects `protected-routes`.
   - > Superseded 2026-10-11: the `auth.config.ts` split and its defence no longer apply, because Auth.js was removed (PR #10). The proxy only checks that the session cookie is present and loads no Prisma or Argon2, so the edge-vs-Node question doesn't matter — see [architecture.md](../../architecture.md).
   - **Done:** Next.js docs warn that the proxy is **not** a full security boundary. The proxy now only checks that the cookie is present, and every page with private data and every Server Action calls `requireUser()` (standard [`global/auth-security`](../../../../standards/global/auth-security.md)).

---

## Sources

- [Prisma Config API (v7)](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference)
- [Prisma Config reference](https://www.prisma.io/docs/orm/reference/prisma-config-reference)
- [Auth.js joins Better Auth](https://www.better-auth.com/blog/authjs-joins-better-auth)
- [Auth.js is now part of Better Auth (GitHub discussion)](https://github.com/nextauthjs/next-auth/discussions/13252)
- [Auth.js concepts](https://authjs.dev/concepts)
- [Better Auth joins Vercel](https://better-auth.com/blog/better-auth-joins-vercel)
- [Next.js Proxy replaces Middleware](https://johnkavanagh.co.uk/articles/next-js-proxy-replaces-middleware/)
- [Next.js proxy.ts auth migration guide](https://medium.com/@securestartkit/next-js-proxy-ts-auth-migration-guide-ff7489ec8735)
- [Next.js middleware docs](https://nextjs.org/docs/api-routes/middleware)
