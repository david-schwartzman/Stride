# Project Audit — check catalogue

Each check lists what to compare and the default severity. Adjust severity by real downstream impact (see SKILL.md Step 4). Sections A–H run top-down.

## Contents
- A. Customer → Product
- B. Product → Standards
- C. Product / Standards → Epics
- D. Epics → Specs (contradictions, ownership, status, plan vs reality, internals)
- E. References and evidence
- F. Indexes
- G. Root docs
- H. Code ↔ Specs
- Fix routing

---

## A. Customer → Product

| Check | Example | Sev |
|---|---|---|
| Product tech-stack contradicts customer tech-stack | customer: "Postgres everywhere"; product: "MongoDB" without a stated exception | high |
| architecture.md uses a service/package missing from tech-stack.md or dependencies.md (or vice versa) | architecture uses Upstash Redis; dependencies.md doesn't list it or its env vars | med |
| mission.md / roadmap.md disagree with architecture on what's built | roadmap promises social login; architecture says email+password only | med |
| roadmap epic list ≠ epic folders | roadmap names `reviews` epic; no folder; or a folder not on the roadmap | med |
| Ambiguity: TBD / "decide later" / undefined term in a product doc that epics build on | "session store: TBD" | med |

## B. Product → Standards

| Check | Example | Sev |
|---|---|---|
| A standard contradicts the product docs | standard says "branch off main"; config.yml / git-workflow says `develop` | high |
| `standards/index.yml` entry with no file, or file not indexed | | low |
| Standard references a tool/version the tech-stack no longer uses | | med |

## C. Product / Standards → Epics

For each epic: `epic.md`, `tech-plan.md`, `product-brief.md`.

| Check | Example | Sev |
|---|---|---|
| tech-plan Approach / Architecture Impact uses something architecture.md or tech-stack.md rules out | tech-plan: "database sessions"; architecture: "JWT sessions" | high |
| Two epics plan to own the same route/component/model | cart-checkout and account-wishlist both plan `/account/orders` | high |
| product-brief promises behavior the tech-plan or architecture can't deliver | brief: "log out on all devices"; architecture: stateless JWT, no revocation | med |
| epic.md Out of Scope contradicts its own brief or tech-plan | | med |
| epic.md Status contradicts its specs (epic `planning` while specs are `done`; epic `done` with open specs) | | med |
| Risks & Unknowns entry still open but a spec has silently decided it — or a spec needs it decided and doesn't mention it | tech-plan: "Unknown: Next 15 vs 16"; spec picks 16 without updating the plan | med |
| Epic dependency order contradicts roadmap order | epic B needs epic A's model; roadmap puts B first | med |
| Missing required sections vs sibling epics / `/plan-epic` template | | low |

## D. Epics → Specs

### D1. Contradictions

| Check | Example | Sev |
|---|---|---|
| Spec Technical Approach uses something architecture.md / tech-stack.md / tech-plan rules out | spec uses `middleware.ts` on edge with Prisma; architecture Gotcha says edge-safe config only | high |
| Spec breaks a standard (branch name, commit format, testing rule, stack rule) | `> Branch: feature/x` vs standard `feat/<epic>/<spec>` | med |
| Two specs define the same thing differently | field `userId` vs `user_id`; session TTL 7d vs 30d; different redirect target | high |
| Spec scope contradicts epic Out of Scope | spec ships password reset; epic Out of Scope lists it | high |
| Spec's handoff to a sibling isn't picked up | spec A: "protected-routes will add callbackUrl"; protected-routes never mentions it | med |

### D2. Ownership

`> Covers:` lists routes and paths a spec owns.

| Check | Example | Sev |
|---|---|---|
| Two specs' Covers claim the same route or overlapping path/glob (across *all* epics) | both cover `src/features/auth/**`, or `/login` | high |
| A route in architecture.md (or a planned page in the tech-plan/brief) that no spec covers — and no Candidate Spec plans to | architecture lists `/wishlist`; no spec or candidate owns it | med (high if its epic is in-progress) |
| A spec edits files another spec covers without saying so in Technical Approach | | med |
| Covers missing entirely | | med |

### D3. Status drift

| Check | Example | Sev |
|---|---|---|
| Spec `> Status:` ≠ epic.md Specs table status | spec `in-progress`; epic table `shaped` | med |
| Spec Branch ≠ epic.md table branch | | low |
| All tasks `[x]` (or `[-]`) but spec not `done` — or spec `done` with open `[ ]`/`[~]` tasks | | med |
| Spec `in-progress`/`done` but no tasks ticked | | med |

### D4. Plan vs reality

| Check | Example | Sev |
|---|---|---|
| A spec listed in tech-plan Candidate Specs / epic.md that was never shaped | candidate `guest-cart-merge`, no folder | med (high if an in-progress spec depends on it) |
| A spec shaped under a different slug than planned (the plan still lists the old slug) | planned `auth-guard`, shaped as `protected-routes` | low |
| A spec folder not in the epic's Specs table / Candidate list | | med |
| A Risk or Unknown the spec quietly decides, while the tech-plan still lists it open | | med |

### D5. Spec internals

Compare against the templates in `.claude/commands/softwareos/shape-spec.md` (§ spec.md Content, tasks.md Content).

| Check | Example | Sev |
|---|---|---|
| An AC no task covers (no implementing task and no verification task mapped to it) | AC5 banner; no task mentions banner | med |
| A task that serves no AC and isn't setup/verification | | low |
| AC or task numbering gaps / duplicates (task IDs are append-only, so gaps from `[-]` are fine; duplicates are not) | two `T7` lines | med |
| Missing Changelog table, or empty | | med |
| Required sections missing vs template: header lines (`> Epic`, `> Status`, `> Branch`, `> Covers`), Overview, Goals & User Stories, Acceptance Criteria, Technical Approach, Out of Scope, Standards Applied, Changelog | | med if ACs/Approach missing, else low |
| tasks.md header (`> Epic`, `> Spec`, `> Branch`) disagrees with spec.md | | low |
| No Verification group in tasks.md (`production` mode) | | med in production, low in setup |
| Folder name date/slug doesn't match the slug used elsewhere | | low |
| Ambiguity that will compound: TBD, "decide during implementation", or a term no doc defines, that a task or sibling spec depends on | "use the standard error shape" with no standard defining it | med |

## E. References and evidence

| Check | Example | Sev |
|---|---|---|
| Broken link (relative path doesn't resolve) | `../../../../standards/global/api.md` missing | low (med if it's the only definition of something) |
| Slug / spec / epic reference to something that doesn't exist or was renamed | "see signup-login AC12" — only 11 ACs | med |
| AC or task ID cited (in another spec, Changelog, references.md, qa-report) that doesn't exist | | med |
| `qa-report.md` older than the spec's last AC / Technical Approach change, and not already marked stale | report 2026-09-01; Changelog row 2026-09-20 changes AC3 | med |
| `> Reviewed:` in tasks.md older than the last Technical Approach change or task addition, not marked stale | | med |
| references.md / standards.md cite a standard or reference that no longer says what's claimed | | low |

Use `git log -1 --format=%cs -- <file>` and the Changelog dates to compare ages.

## F. Indexes

Index formats and parsing rules: `.claude/commands/softwareos/refresh-indexes.md`.

| Check | Example | Sev |
|---|---|---|
| Expected index missing (`ecosystem/products.index.yml`, `products/<p>/epics.index.yml`, `epics/<e>/specs.index.yml` once specs exist) | | low (med if a command reads it) |
| Index lists a folder that doesn't exist, or misses one that does | | med |
| Index status / covers / branch ≠ the spec's header lines | | med |
| `standards/index.yml` out of sync with files | | low |

Report all index drift as one finding per index file, fixed by `/refresh-indexes`.

## G. Root docs (outside `softwareos/`)

| Check | Example | Sev |
|---|---|---|
| Root doc states as current fact a decision product docs have since changed | design-rationale.md: "we use JWT sessions"; architecture.md now: database sessions | med |
| A rationale section argues for a superseded decision with no "Superseded" note | | low |
| A plan doc (e.g. INFRA_PLAN.md) proposes changes that were never cascaded — or partially cascaded | INFRA_PLAN adds Redis; architecture has it, tech-stack doesn't | med (high if specs are being built on the old version) |
| README describes setup/commands that contradict tech-stack | | low |

## H. Code ↔ Specs (only if code exists)

| Check | Example | Sev |
|---|---|---|
| Route/page in code no spec Covers | `src/app/admin/page.tsx` — unowned | med |
| Spec `done` but files in its Covers don't exist | | high |
| Code uses a ruled-out tech or breaks a Gotcha | Prisma imported in edge middleware | high |
| Code behavior contradicts an AC of a `done` spec | AC3 rejects `//evil.com`; code accepts it | high |
| Package in package.json not in tech-stack/dependencies, or vice versa | | low |

Don't run builds or tests — read and grep only.

---

## Fix routing

| Finding is in… | Fix command |
|---|---|
| A shaped/in-progress/done spec's content (ACs, approach, Covers, tasks, Out of Scope) | `/spec-changes <epic>/<spec>` |
| A planned spec that was never shaped; unowned route that needs an owner | `/shape-spec` (in the owning epic) |
| An architecture decision that didn't cascade (product doc vs several lower levels, or a root plan doc not applied) | `/update-arch` |
| Any `index.yml` drift | `/refresh-indexes` (run last) |
| Standards index only | `/index-standards` |
| epic.md / tech-plan.md / product-brief.md content | manual edit (or `/plan-epic` to re-plan) |
| Product docs alone (one file wrong, nothing below depends on it) | manual edit (or `/plan-product`) |
| A standard | manual edit |
| Stale qa-report / review | mark stale per `/spec-changes` Step 6, then re-run the `qa` skill / `/code-review` |
| Code contradicts a done spec | `/hotfix` |
| Root doc fact or missing Superseded note | manual edit |
