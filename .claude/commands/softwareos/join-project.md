---
name: join-project
description: Onboard an existing codebase — discover customer, ecosystem, products, and epics from the code
---

# /join-project

One-shot discovery for onboarding an **existing codebase** into SoftwareOS. Infers the planning hierarchy — **customer → ecosystem → products → epics** — from the code, asks for the **project mode** (`setup` / `production`), writes the docs and the nested folder tree, generates the indexes, and emits a `join-report.md`.

**Design principle: discovery-first, two gates, parallel deep-dive.** Infer everything you can from the filesystem and code, then stop for exactly two questions: the **taxonomy** (correct what was discovered) and the **mode** (choose the verification regime — never inferred). Fan out the per-product code exploration in parallel. Beyond those two, do not walk the user through a question sequence — that is the slowness this command exists to avoid.

Greenfield projects should use `/plan-customer` / `/plan-product` instead; this command is for code that already exists.

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if `<root>/softwareos/` exists that's the SoftwareOS root, else walk up from cwd for a `softwareos/` folder.
2. If none exists, scaffold a minimal one at the workspace root: `softwareos/{customer,ecosystem,products,standards}/` and a `config.yml` (`customer: TBD`, `default_branch:` from `git symbolic-ref --short refs/remotes/origin/HEAD` else `main`, `mode:` written in step 5). (The installer normally does this; handle the case where it didn't.)
3. Read `softwareos/config.yml`.
4. Enumerate from the filesystem, never from caches.

## 1. Scan the workspace

Enumerate candidate repos = immediate subdirectories of the workspace root that contain a project manifest, **ignoring** `.claude/`, `softwareos/`, `node_modules/`, `.git/`, and dotfiles.

Manifests to look for: `package.json`, `pom.xml`, `*.csproj`/`*.sln`, `go.mod`, `pyproject.toml`/`requirements.txt`, `composer.json`, `Cargo.toml`, or a `src/` + framework layout.

For each repo capture:
- **name** (dir name),
- **tech** — from the manifest's key dependencies (e.g. `next`/`react`/`vue`/`@angular/core`/`vite` → frontend; `express`/`@nestjs/core`/`fastify`/`django`/`spring` → backend; `@strapi/strapi`/`umbraco` → CMS),
- **role** — `client` if the name ends `-client`/contains `client`/`frontend` or has frontend deps; `server` if `-server`/`-backend`/`-api` or backend deps; `shared` for CMS / shared-service names (`cms`, `chat-ai`, `auth`, `shared`, `common`).

Do **not** use `.git` to decide anything — repos may be plain directories (e.g. downloaded, not cloned).

### Mode context

While walking each repo, also note the facts that are **useful context for the mode question in step 3**. You're already reading every manifest and layout, so gather these in the same pass rather than a second sweep.

| Fact | Look for |
|---|---|
| **CI** | `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/` |
| **Real tests** | a configured runner (`scripts.test`, `pytest`, `go test`, …) **and** test files actually present — a `test` script pointing at nothing doesn't count |
| **Deploy artifacts** | `Dockerfile`, `docker-compose.yml`, `k8s/`, `terraform/`, `vercel.json`, `fly.toml`, `serverless.yml` |
| **Released** | semver git tags (`git tag --list 'v*'`), or a `CHANGELOG.md` with more than one release heading |
| **Maturity** | committed lockfile, and a default branch with substantial history (`git rev-list --count HEAD`) |

Record what you found and what's missing. **This is context you show the user, not a verdict you compute.** These artifacts describe how the code is *built*; the mode is a decision about how the team wants to *work* — whether this system is live enough to demand tests, security review, and QA on every spec. A repo can have full CI and be an abandoned prototype, or have no tests at all and be serving production traffic today. Only the user knows which. Never infer the mode from these facts, and never pre-select an answer from them.

## 2. Propose the taxonomy — the discovery gate

Cluster the scanned repos into **products**:
- group by common name prefix and client/server pairing — e.g. `rental-client` + `rental-server` → product `rental`; `<x>-app` + `<x>-app-backend` → product `<x>-app`;
- repos that are shared services or used across products (`cms`, `chat-ai`, `auth`, …) → mark **shared** (listed in the ecosystem, not owned by one product);
- set **customer** = the workspace directory name, kebab-cased.

Present the **entire** proposed taxonomy at once — customer name, each product with its repos, and the shared services — in a single `AskUserQuestion` (or one compact confirm block). The user corrects in bulk: rename / regroup / merge / split products, mark a repo shared, or change the customer. Apply their corrections and continue; do not re-ask per product.

On re-run: pre-fill the proposal from the existing `ecosystem/products.index.yml` and update in place — never duplicate a product or epic.

## 3. Ask for the mode — the policy gate

The taxonomy is discovered; the **mode is chosen**. Ask for it directly with `AskUserQuestion` — never infer it from the step-1 context and never pre-select from it. This is the second and last required interaction.

Show what you found as context, then ask:

```
What mode should this project run in?

What I found: CI in 3/4 repos · 128 test files · Dockerfile + terraform/ · 47 v* tags
Missing: no softwareos/standards/testing/*

1. production — this system is live or close to it. Every spec will demand unit
   tests, security review, and full QA; /verify, the qa skill, and the pr
   preflight will fail on missing verification.
2. setup — still finding our footing (prototype, rewrite, takeover of
   unmaintained code). Lightweight gates; tests and QA stay optional per spec.
   You can switch later with /go-production.
```

Two things to be clear about when asking:

- **Brownfield does not imply `production`.** This command is always brownfield. Mode tracks whether the system is *live*, not whether the code is *old*.
- **Say the cost of each.** `production` is a real constraint on every future spec, and `setup` means the gates won't catch an unverified spec. The user should be choosing between consequences, not between labels.

On re-run, if `config.yml` already has a `mode:`, show it as the current value and ask whether to keep or change it. Never change it without an answer — and never quietly downgrade a project already in `production`.

## 4. Deep-discover per product (in parallel)

For each confirmed product, dispatch the **`code-explorer`** agent — **concurrently** (issue all the Agent calls in a single message) — scoped to that product's repos. Ask each to return:
- a one-paragraph **mission** (what the product does, for whom),
- **tech-stack** (frontend / backend / data / infra),
- an **architecture** sketch (components, data flow, environments, gotchas),
- **dependencies** (internal services it calls + external APIs),
- **2–5 candidate epics** — coherent feature surfaces, as kebab slugs (e.g. `authentication`, `checkout`, `homepage`, `admin-dashboard`).

The parallel fan-out is deliberate: it keeps discovery fast across many repos. Reuse the output shape that `/plan-product` expects from `code-explorer`.

## 5. Write the docs + folder tree

Write these, reusing SoftwareOS's existing doc shapes (see `plan-customer.md`, `plan-ecosystem.md`, `plan-product.md`, `plan-epic.md`):

**Customer** (`softwareos/customer/`):
- `overview.md`, `team.md`, `tech-stack.md`, `repos.md`. Infer what you can from READMEs/manifests; put `TBD` where you can't (team, business goals). Aggregate `tech-stack.md` across products. `repos.md` = a table of every scanned repo (name, role, product, tech).
- Patch `config.yml`: `customer:` = the confirmed customer slug; keep `default_branch:`; write `mode:` = **the mode the user chose in step 3**. Always write the key explicitly, even when the answer was `setup` — a config with no `mode:` falls back to `setup` anyway, but leaving it implicit hides the fact that someone decided.

**Ecosystem** (`softwareos/ecosystem/ecosystem.md`): the ASCII map + a Relationships table (consumer → depends-on → via) + note the shared services. (The product **registry** is the generated `products.index.yml`, written in step 6.)

**Each product** (`softwareos/products/<slug>/`):
- `mission.md` — include an H1 title and a `> Name:` header line; note the product's repos.
- `tech-stack.md`, `architecture.md`, `dependencies.md` — from the `code-explorer` output.
- `repos.md` — a table of this product's repos (name, role, tech).
- `roadmap.md` — a **TBD stub**, exactly: `# Roadmap — <Name>\n\n_Pending — run /plan-product as PM to fill._`

**Each candidate epic** (`softwareos/products/<slug>/epics/<epic-slug>/epic.md`): reuse `plan-epic.md`'s `epic.md` shape — H1 title, `> Product: ../../mission.md`, `> Status: planning`, `> Created: <today>`, a one-line Summary, and an empty Specs section. (No Bugs section — SoftwareOS has no bugs folder; defects are handled by `/hotfix`, which amends the owning spec's Changelog.)

Do **not** hand-write any `index.yml` in this step.

## 6. Generate indexes + join-report

1. Run the **`/refresh-indexes`** procedure (see `refresh-indexes.md`) to generate all three index families from the tree you just wrote: `ecosystem/products.index.yml`, each `products/<slug>/epics.index.yml`, and each `epics/<epic>/specs.index.yml` (seeded empty). This keeps index format defined in exactly one place. (There is no bugs index — SoftwareOS has no bugs folder.)
2. Write `softwareos/join-report.md` — a one-page summary (regenerated on re-run):
   - **Taxonomy** — a table: customer, each product with its repos, shared services.
   - **Mode** — the mode the user chose, the context they were shown when choosing (what was found, what was missing), and any reasoning they gave. Record it as their decision, not as a discovery. In `production`, add the one-line consequence: specs will demand tests + security review + full QA.
   - **Counts** — N products · N epics discovered.
   - **Inferred vs. TBD** — what was confidently inferred and what was left `TBD` for a human.
   - **Uncertainties** — anything ambiguous (e.g. a repo that could belong to two products, a possible separate customer).
   - **Next steps** — `/plan-product` to flesh out a product, `/shape-spec` to start the first spec, `/refresh-indexes` after manual edits, `/go-production` to change the mode later.

## 6. Carry over AgentOS (if present)

Onboarding often runs on a repo that already used the **official AgentOS**. Now that products and epics exist (steps 4–5), this is the correct moment to migrate that old planning — so migration is **part of join-project**, not a separate thing the user has to remember.

1. **Detect.** Scan for `agent-os/` folders that contain `product/`, `specs/`, or `standards/`, in all of: the workspace root, one level inside each product repo (`<repo>/agent-os`), and immediate siblings. Ignore `.git/`, `node_modules/`, `softwareos/`. Enumerate **every** match — there may be more than one. For each match, **count its dated spec folders** (the check in `migrate-agent-os.md` Step 2e) — you need this for the next step.
2. **If none found:** skip this section silently.
3. **If one or more found:** offer to migrate, using AskUserQuestion. **A source with zero spec folders cannot be migrated** (migration carries specs, and its last step deletes the source) — either omit it from the list, or show it disabled with the reason. Always include an explicit **"Enter a different path"** option:

```
This repo has AgentOS planning I can carry over now. Migrate it?

1. ./agent-os            — specs: <list>
2. ./<repo>/agent-os     — no specs, cannot migrate
3. Enter a different path
4. Skip — I'll migrate later with /migrate-agent-os

(Choose one)
```

If a standards-only or product-docs-only folder is all that exists, don't route it here — point the user at `/discover-standards` / `/plan-product` instead.

4. **If the user picks a source:** run the **`/migrate-agent-os` procedure** (see `migrate-agent-os.md`) **from its Step 2e** — skip Step 1 (the epic gate is already satisfied) and 2a–2d (the path is chosen), **but 2e still runs**: it is the specs-required gate that stops a source with no specs from reaching the deletion in Step 8, and it also handles the "re-check after Step 3's filter" case. Do **not** start at inventory (Step 3) — that would bypass the gate. Migrate one source per pass; when it finishes, offer the next detected source. Everything else — layout detection, epic placement, spec splitting, standards/doc carry-over, reconciliation, the backup, the report, and the gated deletion — is exactly the migrate procedure.
5. **If the user skips:** note in `join-report.md` that AgentOS was detected at `<paths>` and can be carried over later with `/migrate-agent-os`.

`/migrate-agent-os` still exists as a standalone command — for migrating a source later, re-running against another AgentOS folder, or pointing at one far away. Folding it into join-project just means the common case (onboard a repo that had AgentOS) happens in one flow.

## Done

Report to the user: the confirmed taxonomy, **the mode they chose**, what was written (counts), whether AgentOS was migrated (and the migration report path if so), and a pointer to `softwareos/join-report.md`. Note that the docs are a discovered first draft — `/plan-*` commands refine them, and `/go-production` changes the mode later.
