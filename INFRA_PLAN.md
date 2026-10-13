# Stride: Infrastructure Plan

> Goal for now: **infrastructure set up and specs ready, with no code.** Accounts and connections are configured; proving it all works (the spike) happens when implementation starts.
> Written: 2026-10-08

**Legend**

- 🧑 **Human**: needs accounts, logins, approvals, payments or real secrets. An agent can't (or shouldn't) do it.
- 🤖 **Agent**: files, commits or commands a coding agent can do for you.
- 🤝 **Both**: the agent does the work, and a human checks or approves the result.

**Rule of thumb:** an agent can't create accounts, log into dashboards, click "Allow access" screens or choose paid plans. It also **shouldn't handle real secrets** (database passwords, `PASSWORD_PEPPER` / `GUEST_CART_SECRET` values). You handle those yourself.

The plan has two phases:

- **Phase 1: Now (no code).** Everything below that can be done before a single line of app code exists.
- **Phase 2: Later (when implementation starts).** Steps that need the app scaffold to exist.

---

## Accounts you need

| Service | Why | Notes |
|---|---|---|
| **GitHub** | Code + CI (GitHub Actions) | ✅ Already set up (`david-schwartzman/Stride`, `develop` exists) |
| **Vercel** | Hosting + a preview site per PR — two projects in the same account since 2026-10-13: the existing `stride` project (today's single Next app, which becomes the web project at `apps/web`) and `stride-api` (NestJS, created in Phase 2 step D2) | Sign up with GitHub. ⚠️ The free **Hobby plan is non-commercial only**. If Stride is client work, check with the team whether you need **Pro** or a company team account. |
| **Neon** | Postgres database + a database branch per preview | Sign up with GitHub. The free plan limits the number of branches. |

No other accounts are needed (the NestJS API runs on the same Vercel account). Prisma, `@node-rs/argon2`, Vitest and Playwright are free libraries the agent installs into the project. They need no sign-up.

---

# Phase 1: Now (no code)

## Step 1: Install Node.js — 🧑 Human

*(About 10 min. `node` is currently not installed on this machine.)*

1. Install **Node.js LTS** (v22 or newer), either with the installer from nodejs.org or with `brew install node`.
2. Check it worked: `node -v` and `npm -v`.

Nothing runs yet, but every later step and every implementation task needs it.

## Step 2: Choose a Prisma version — 🧑 Human (decision) → 🤖 Agent (if the spec changes)

*(1 min. Choose only: there's no account and nothing to install.)*

- **Prisma 6 (recommended for now):** the `app-foundation` spec works exactly as written.
- **Prisma 7:** `directUrl` moved from `schema.prisma` to `prisma.config.ts`, and the client needs a driver adapter. 🤖 The agent updates the `app-foundation` spec via `/spec-changes`, so the spec is correct before implementation.

## Step 3: Create accounts and Neon branches — 🧑 Human

*(About 15 min.)*

1. Create the **Vercel** account (signed in with GitHub) and choose the plan.
2. Create the **Neon** account. Create a project named `stride` in a region close to your Vercel region (e.g. US East).
3. In Neon, set up branches. ⚠️ **Untick "expiration / auto-delete" on every branch you create.** A branch with an expiration gets deleted automatically and **can't have child branches**.

   ```
   main (or "production": the root branch Neon created)  → future real shop; leave it alone
    └── develop      → clean template; every PR preview is copied from it
         └── dev-david  → your personal sandbox for the app on your laptop
   ```

   - **`develop`**: create from the root branch. **No expiration.**
   - **`dev-david`**: create from `develop`. **No expiration.**
4. Check that neither branch page shows "Will automatically delete on…".

> Don't create Neon branches per feature. PR previews get their own copies automatically (Step 6), and your laptop only needs `dev-david`.

> **Skip Neon's "get started" CLI prompt** (`neon skills`, `neon mcp`, `neon link --branch production`, `neon config init`, `neon deploy`). This plan doesn't need the Neon CLI. Those commands add unvetted agent skills, give agents access to your Neon account, link your folder to the **production** branch, and add config files the specs don't cover.

## Step 4: Prepare local secrets (no file yet) — 🧑 Human

*(About 5 min.)*

Collect these and keep them somewhere safe, like a password manager, **not** in the repo or in chat:

- `dev-david` **pooled** connection string (hostname contains `-pooler`) → later `DATABASE_URL`
- `dev-david` **direct** connection string → later `DIRECT_URL`
- A local `PASSWORD_PEPPER` and a local `GUEST_CART_SECRET`. Generate each with `openssl rand -base64 32` (works without Node).
- ⚠️ **Back up every `PASSWORD_PEPPER` value** in the password manager. If a pepper is lost, every password hashed with it is lost too.

The `.env.local` file itself gets created in Phase 2, once the app exists.

## Step 5: Connect Vercel and Neon — 🧑 Human

*(About 20 min.)*

1. In Vercel: **Add New → Project → import `david-schwartzman/Stride`** (Root Directory: repo root). This project runs today's single Next app. Once `api-foundation` lands it becomes the **web** project; the API project is created later, in Phase 2 step D2.
   - ℹ️ Vercel may try a first build and **fail**, because there's no app yet. That's expected and harmless.
2. Settings → Git: production branch can stay `main` for now (production deploys belong to the launch-polish epic).
3. Install the **Neon integration** from Vercel's Marketplace/Integrations and connect it to the `stride` Neon project and attach it to this project for now, because the pre-split app (app-foundation, signup-login) talks to the database directly. It moves to the API project in Phase 2 step D2:
   - turn on **"create a database branch for each preview deployment"**,
   - set the **parent branch to `develop`**,
   - turn on **automatic branch deletion** if it's offered.
4. Vercel → Settings → Environment Variables:
   - `PASSWORD_PEPPER` and `GUEST_CART_SECRET` on this project for now (the pre-split app needs them): add a fresh value for **Preview** and a different one for **Development**. In Phase 2 step D2 they're copied to the API project, and they're removed from this project only after `auth-api-migration` ships. Generate each with `openssl rand -base64 32`, and back up the peppers. Production comes later, with its own values.
5. **Write down** the exact names of the database variables the Neon integration added. The direct one is usually `DATABASE_URL_UNPOOLED`, not `DIRECT_URL`. The agent needs these names in Phase 2.
6. **Write down** whether the integration offered automatic branch deletion. If it didn't, Phase 2 needs a cleanup workflow.

## Step 6: GitHub settings — 🧑 Human (🤖 agent can do it with your approval)

1. Set GitHub's **default branch to `develop`** (Settings → General → Default branch), so new PRs target it automatically, as the git-workflow standard requires.

> The agent can do this with the `gh` CLI, since you're already logged in, but only after you say yes.

## Step 7: Get the specs ready — 🤖 Agent (🧑 Human reviews)

Currently untracked or uncommitted on `chore/auth-first-epic`:

- `softwareos/products/stride/epics/accounts-auth/epic.md` (modified)
- `softwareos/products/stride/epics/accounts-auth/specs.index.yml`
- `softwareos/products/stride/epics/accounts-auth/specs/` (app-foundation + signup-login)
- `softwareos/products/stride/epics/accounts-auth/design-rationale.md`
- `stride-design/` (design files the specs reference)
- `INFRA_PLAN.md` (this file)

🤖 The agent commits them and opens a PR to `develop` (including any Prisma 7 spec update from Step 2). 🧑 You review and merge.

---

## Phase 1 checklist (for tomorrow)

| # | Step | Who | Done |
|---|---|---|---|
| 1 | Install Node.js | 🧑 Human | [ ] |
| 2 | Choose Prisma 6 or 7 | 🧑 Human (🤖 updates spec if 7) | [x] Prisma 6 (2026-10-11) |
| 3 | Vercel + Neon accounts; `develop` + `dev-david` with **no expiration** | 🧑 Human | [ ] |
| 4 | Collect `dev-david` connection strings + local `PASSWORD_PEPPER` and `GUEST_CART_SECRET` (stored safely) | 🧑 Human | [ ] |
| 5 | Import repo to Vercel, Neon integration (parent `develop`), `PASSWORD_PEPPER` + `GUEST_CART_SECRET` per env, note variable names | 🧑 Human | [ ] |
| 6 | GitHub default branch → `develop` | 🧑 Human (or 🤖 with approval) | [ ] |
| 7 | Commit specs, rationale, design files, this plan → PR to `develop` | 🤖 Agent (🧑 reviews) | [ ] |

---

# Phase 2: Later (when implementation starts)

These need the app scaffold, so they're part of implementing the `app-foundation` spec.

| # | Step | Who | Needs |
|---|---|---|---|
| A | Scaffold the app: Next.js, tooling, Prisma setup (since 2026-10-13 the monorepo — `apps/web`, `apps/api` NestJS with Prisma, `packages/shared` — comes in candidate spec `api-foundation`), `.env.example`, `ci.yml` (app-foundation T1–T5, T7) on `feat/accounts-auth/app-foundation`, as a draft PR | 🤖 Agent (🧑 reviews) | Step 1, Step 2 |
| B | Create `.env.local` from `.env.example` with the values from Step 4; check `npm run dev` | 🧑 Human | A |
| C | Preview build command: `prisma migrate deploy` before the build (on the API project after `api-foundation`), mapping Neon's direct URL to `DIRECT_URL` | 🤖 Agent | A + variable names from Step 5.5 |
| D | If the integration doesn't delete branches: add a GitHub workflow that deletes the preview's Neon branch on PR close (T6.2). 🧑 You create a Neon API key and add it as a GitHub secret. | 🤖 Agent + 🧑 Human | A, Step 5.6 |
| D2 | **Create the API project** (when `api-foundation` starts): Add New → Project → the same repo, name `stride-api`, Root Directory `apps/api`; set the existing project's Root Directory to `apps/web`. Attach the Neon integration to `stride-api` (preview branch per deployment, parent `develop`). Copy `PASSWORD_PEPPER` and `GUEST_CART_SECRET` to `stride-api` with the **same values** per environment (a new pepper would lock out every existing account), and add `CRON_SECRET`. Generate `WEB_PROXY_SECRET` (`openssl rand -base64 32`) and set the same value on both projects, a different one per environment. Add `API_URL` to the web project. On `stride-api`, create the Deployment Protection "bypass for automation" secret and add it to the web project's Preview env. Remove `DATABASE_URL`, `DIRECT_URL`, `PASSWORD_PEPPER` and `GUEST_CART_SECRET` from the web project only after `auth-api-migration` ships | 🧑 Human (🤖 updates `.env.example` and the docs) | A, `api-foundation` branch |
| E | **Spike:** a PR gets its own Neon branch, the build runs migrations, the preview loads (after `api-foundation` and step D2: settle how the web preview reaches the API preview from the same commit, and check that the protection bypass works and that a direct call without `WEB_PROXY_SECRET` gets 401), CI is green, and closing the PR deletes the branch (T6.1) | 🤝 Both | A–D |
| F | GitHub → Settings → Branches: require the CI check before merging into `develop` (the check only appears after CI has run once) | 🧑 Human (or 🤖 with approval) | E |

After Phase 2, the infrastructure is **proven working**, and the rest of `app-foundation` (design system, header, footer) and then `signup-login` can be built.
