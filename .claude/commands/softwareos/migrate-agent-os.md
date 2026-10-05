---
name: migrate-agent-os
description: Optional migration for a project already running the official AgentOS — map its product docs, specs, and standards into the SoftwareOS hierarchy, then remove AgentOS. Run it only if you have an agent-os/ folder to carry over. Requires the SoftwareOS product/epic structure to exist first (via /join-project).
argument-hint: "[path-to-agent-os] [--dry-run]"
---

# /migrate-agent-os

One-shot migration for a project that already ran the **official AgentOS**. It maps the AgentOS artifacts into the SoftwareOS hierarchy — product docs → `softwareos/products/<product>/`, specs → `products/<product>/epics/<epic>/specs/…`, standards → `softwareos/standards/` — asking the user whenever the mapping is ambiguous, then removes AgentOS so there are zero leftovers.

**Design principle: SoftwareOS must exist first, then map, then clean up — nothing is deleted until the mapping is verified.** AgentOS is flat (product → specs); SoftwareOS is deep (customer → product → epic → spec). Specs therefore need an epic to live in, and epics are created by `/join-project` (or `/plan-epic`). So this command depends on that structure already being present.

**Invoked as part of `/join-project`.** In the normal onboarding flow, `/join-project` detects an `agent-os/` folder after it has created the products and epics, and runs this procedure automatically (its final phase). When called that way, the join-project gate is already satisfied and the source path is already chosen, so Step 1 and the auto-detect part of Step 2 are skipped.

**Also runnable standalone.** Run `/migrate-agent-os` directly to migrate a source later, re-run against another AgentOS folder, or point at one far away. Greenfield projects with nothing to migrate never need it.

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if `<root>/softwareos/` exists that's the SoftwareOS root, else walk up from cwd for a `softwareos/` folder.
2. If none exists, SoftwareOS isn't installed here. Tell the user to install it first (`<base>/scripts/project-install.sh`) and stop — this command maps into an existing SoftwareOS install, it does not create one.
3. Read `softwareos/config.yml`. If `customer_root` is set, note it (product docs may live in a hub repo).
4. Enumerate from the filesystem, never from caches: products = dirs under `softwareos/products/`; epics = dirs under `products/<product>/epics/`.

## Execution Contract — read first

**This command performs the migration; it does not merely plan it.** Except under `--dry-run`, you MUST actually create folders and write files to disk. Do not describe what you *would* do, produce a plan, and stop — that is a failure of this command.

The flow has exactly **one** pause for user approval: the deletion in Step 8. Everywhere else, once you have the information a step needs (including the epic answers from Step 6a), **proceed immediately to writing** — do not stop after "recording decisions," do not wait for a "go ahead" before Step 4/5/6, do not end your turn until every spec folder, index, and the report are written to disk.

Checkpoint before you finish (non-`--dry-run`): every migrated spec has `spec.md` + `tasks.md` on disk, indexes are regenerated, `migration-report.md` exists. If any is missing, you are not done — keep going.

## Important Guidelines

- **Always use the AskUserQuestion tool** when asking the user anything.
- **One question at a time** — wait for each answer.
- **Never delete AgentOS until the user confirms** the migration report (Step 7). Do the whole migration on a branch.
- **Idempotent** — re-running must not duplicate a spec or epic; detect what already migrated and skip or update in place.
- **`--dry-run`** — if passed, do everything read-only: inventory, resolve the epic mapping (still asking the user when unknown), and write only `migration-report.md` marked `DRY RUN`. Write no spec/doc files and delete nothing. Use it to preview a migration safely.
- **Work on a branch** — before writing anything (unless `--dry-run`), create and switch to `chore/migrate-agent-os` (per `standards/global/git-workflow.md`).
- **Never rely on git alone for the source** — git can only recover files it *tracks*. AgentOS folders are frequently **untracked** (e.g. a fresh clone of `buildermethods/agent-os`, or added to `.gitignore`). Check `git status`/`git ls-files` on the source; if `agent-os/` is untracked or the repo has no history, the branch does **not** make its deletion reversible. In that case a real backup is mandatory (see Step 8).

## Step 1: Require the epic structure — the /join-project gate

Specs can only be placed once products and epics exist. Enumerate `softwareos/products/*/epics/*`.

**If no products or no epics exist yet**, use AskUserQuestion:

```
Migration places each AgentOS spec inside an epic, but this project has no
products/epics yet. AgentOS has no epic concept — /join-project discovers them
from the codebase, so it has to run first.

1. Run /join-project now, then continue the migration  (recommended)
2. Stop here — I'll run /join-project myself and re-run /migrate-agent-os after

(Choose 1 or 2)
```

- **Option 1:** run the `/join-project` procedure (see `join-project.md`) to completion, then continue to Step 2.
- **Option 2:** stop cleanly. Remind them to re-run `/migrate-agent-os` afterward.

**There is no "continue anyway" option.** A spec placed outside a real epic has no branch namespace (`feat/<epic-slug>/<spec-slug>`), no `epic.md` to appear in, and no path back to a correct home — the slug is immutable once branches exist (`plan-epic.md`). AgentOS is a flat `specs/` with no epics, so every migration needs epics created on the SoftwareOS side, and `/join-project` always creates them.

If products/epics already exist, continue directly to Step 2.

## Step 2: Locate the old AgentOS

**Always ask the user about the path — never silently auto-select one.** Auto-detection only *pre-fills a suggestion*; the user must explicitly confirm or override the source path via AskUserQuestion before anything is read. Even when exactly one `agent-os/` is found, present it and wait for confirmation. This is a required interaction (per the original design: "when the user runs it, we ask about the path").

### 2a. Auto-detect to pre-fill (not to decide)
Scan **all** of these locations for `agent-os/` folders that contain `product/`, `specs/`, or `standards/` (ignore `.git/`, `node_modules/`, `softwareos/`, dotfiles) — there may be **more than one**, and they may be nested inside product repos:

- the SoftwareOS root itself: `<root>/agent-os`
- one level down into each subdirectory (product repos in a workspace-root install): `<root>/*/agent-os` — e.g. `<repo>/agent-os`
- immediate siblings (single-repo install case): `<root>/../agent-os` and `<root>/../*/agent-os`

**Do not stop at the first hit — enumerate every match** (e.g. both `./agent-os` *and* `./<repo>/agent-os`). Use the results only to populate the choices in the question below.

### 2b. Ask which source — always (this is the first interaction, never skip it)
The **very first thing** you do in this command — before reading, inventorying, or writing anything — is ask the user which source to migrate with AskUserQuestion, listing every path from 2a. Never silently pick one, even if only one was found.

**Always include an explicit `Enter a different path` option as one of the listed choices** — every time, whether zero, one, or many sources were auto-detected. Do not rely on the tool's generic free-text/"Other" affordance for this; make it a real, labeled option so the user always sees that a manual path is available. If the user selects it, go to 2c and prompt for the path.

```
Which AgentOS source do you want to migrate? (I found these)

1. ./agent-os              — specs: <spec-a>, <spec-b>
2. ./<repo>/agent-os       — specs: <spec-c>, <spec-d>
3. Enter a different path  — type/paste a path anywhere on disk (relative or absolute)

(Choose one)
```

- **Several found** → list them all (as above) and let the user pick one. Migrate **one per run** — each AgentOS is single-product and maps to one SoftwareOS product. After a source finishes (Step 8), ask `Migrate another AgentOS source? (yes / done)` and loop back here for the next one.
- **One found** → still present it as a one-option pick plus "enter a different path"; wait for the answer.
- **None found, or the user chooses "different path"** → ask for the path explicitly (2c).

If a path was passed as the command argument, treat it as the pre-filled suggestion and still confirm it — don't skip the question.

### 2c. Path format
Accept a path passed as the command argument, or ask:

```
Where is the old AgentOS folder?

Give a path relative to the repo root (recommended) or an absolute one —
pointing at the agent-os/ folder OR its parent:
- ./agent-os                         (in this repo)
- ../legacy-rental/agent-os          (a sibling project)
- /Users/you/projects/rental/agent-os  (absolute)

(Paste the path, or say "cancel")
```

Resolve relative paths against the repo root and store the **absolute** path (it goes in every migrated spec's Changelog). If the user points at a parent, look for an `agent-os/` child inside it.

### 2d. Validate the path shape — and if it's wrong, say why
A path that looks like an AgentOS install contains at least one of: `product/` (mission/roadmap/tech-stack), `specs/` (dated spec folders), `standards/`. This check only rejects paths that are **not AgentOS at all** — **it does not decide whether there is anything to migrate. Step 2e does that.**

If validation fails, don't just error — report exactly what was checked:

```
That path doesn't look like an AgentOS install. I looked under
<resolved-path> for product/, specs/, or standards/ and found none.

1. Try a different path
2. Cancel migration

(Choose one)
```

Re-ask up to twice; if still unresolved, stop cleanly rather than guessing.

### 2e. Require specs — hard gate, before anything is written
Migration exists to carry specs into the epic/spec structure. A source with no specs has nothing to migrate, and **must never reach Step 8's deletion.**

Count spec folders under `<resolved-source>/specs/` matching `^[0-9]{4}-[0-9]{2}-[0-9]{2}(-[0-9]{4})?-` (v3 carries an `HHMM` component, workshop does not). Ignore files, `.`-prefixed entries, and folders matching neither shape (report those as anomalies, don't count them).

**If the count is 0 — or `specs/` doesn't exist — abort. Do not create the branch, copy standards, write a report, or proceed to Step 3.**

```
ABORT — nothing to migrate.
I looked for spec folders under <resolved-source>/specs/ and found 0.
Migration carries specs into the epic/spec structure; there is nothing to carry,
so I stopped before touching anything.
No branch created · no files written · nothing deleted · <source> is untouched.

What you probably want instead:
  /discover-standards   — carry <source>/standards/ across on its own
  /plan-product         — the product docs under <source>/product/
  /shape-spec           — start fresh specs in SoftwareOS
```

There is no flag or prompt that overrides this. A standards-only or product-docs-only carry-over is a different job with its own commands — routing it through a command whose last step deletes the source is what makes it dangerous.

**Re-check after Step 3's filter.** Step 3 asks all-specs vs incomplete-only. If the filtered set is empty (e.g. "incomplete only" where every spec is `done`), abort the same way, naming the filter as the cause and suggesting they re-run choosing "all specs".

## Step 3: Inventory the source

Read the source and report what will be migrated, before touching anything:

- **Product docs:** which of `product/{mission,roadmap,tech-stack}.md` exist.
- **Specs:** list every folder under `agent-os/specs/`, detect its **layout** (see below), and classify its **state** — `done` / `in-progress` / `not-started` (see Step 6c for how). Show the state next to each spec so the user sees the done-vs-future split up front.
- **Standards:** the tree under `agent-os/standards/`.

Ask whether to migrate **all specs (including completed ones, as historical record — recommended)** or only incomplete ones. Default to all if the user has no preference.

### AgentOS source layouts

There are two AgentOS spec layouts in the wild. Detect per spec folder — never assume:

- **v3 (official, buildermethods)** — folder `YYYY-MM-DD-HHMM-<slug>/` containing `shape.md` (sections: `## Scope`, `## Decisions`, `## Context`, `## Standards Applied` — **no** user-stories or requirements section), `plan.md` (the implementation plan), and optionally `standards.md`, `references.md`, `visuals/`. There is **no** `spec.md` or `tasks.md`.
- **workshop / legacy** — folder `YYYY-MM-DD-<slug>/` containing `spec.md`, `tasks.md`, and `planning/{requirements.md,visuals/}` (sometimes `verification/`).

The `product/` and `standards/` layers are the same in both, so Steps 4 and 5 are unaffected — only the spec translation (Step 6) branches on layout.

### Repo topologies (single vs multi-repo)

**Core rule: one AgentOS install is single-product** (a flat `product/` + `specs/`). Determine how the source relates to the SoftwareOS products (which `/join-project` already discovered), and handle accordingly:

- **Single repo, one product** — the ordinary case. The source maps to the one product.
- **Multi-repo, agent-os is its own sibling repo** *(user's diagram 1)* — its specs describe **one** of the sibling product repos. Ask which product (Step 5), then place specs in that product's epics (Step 6a).
- **Multi-repo, one shared agent-os for several products** *(user's diagram 2)* — the source's specs span multiple products. Do **not** assume one product: assign **each spec** a `product / epic` in Step 6a, and handle the shared `product/` docs per Step 5's multi-product branch.
- **Hub repo layout** *(user's diagram 3)* — `customer/` + `ecosystem/` live in a hub repo and satellite repos set `customer_root`; products live under the local repo's `softwareos/products/`. Run migrate **in the repo that owns the product** whose specs you're migrating. "Locating SoftwareOS" already reads `customer_root`; enumerate products from the local `softwareos/products/`.

## Step 4: Map standards (lowest risk — do first)

Copy `agent-os/standards/**` → `softwareos/standards/**`, preserving the subfolder tree exactly — don't assume fixed folders. The two variants differ: **v3** uses freeform subfolders (`api/`, `database/`, …) plus root-level files indexed as `root`; the **Moveo/workshop** variant uses `global/ backend/ frontend/ testing/`. SoftwareOS standards are just `<area>/*.md`, so either tree copies over as-is.

**Don't corrupt the update manifest.** `project-install.sh` installs *profile* standards into `softwareos/standards/` and records a content hash for each in `.claude/softwareos-manifest.yml`; upstream agent-os installs the same profile files into `agent-os/standards/`. So a repo that ran both has near-identical copies on each side. When deciding what to copy:

- **Byte-identical to the destination** → skip silently (it's the same profile standard; prompting is pure noise).
- **Path is in the manifest** (a profile-managed file) and differs → don't silently overwrite; flag it as *"managed by profile — overwriting makes `/update-os` treat it as a permanent conflict"* and let the user choose.
- **Team-authored** (not in the manifest, or a genuinely new file) → copy freely; ask keep / overwrite / skip only on a real content collision.

Then rebuild `softwareos/standards/index.yml` via the `/index-standards` procedure.

## Step 5: Map product docs

AgentOS has one implicit product; SoftwareOS may have several (from `/join-project`). First decide which product these docs describe:

- **One product** (single repo, or agent-os owns one sibling repo) → ask to confirm the product, then map into `softwareos/products/<product>/`:
  - `mission.md` → `mission.md` (add an H1 title and a `> Name:` header line if missing).
  - `roadmap.md` → `roadmap.md`.
  - `tech-stack.md` → `tech-stack.md`.
- **Shared agent-os spanning several products** *(diagram 2)* → the single `product/` docs usually describe the original/primary product only, so they **don't** cleanly map to all. Ask the user: (a) which product the docs describe (map there), or (b) skip the product docs entirely and let `/join-project`'s per-product docs stand. Never copy one agent-os `mission.md` into multiple products. Specs are still distributed per-product in Step 6a regardless.

If a destination file already has real content (not a `_Pending_` stub), ask keep / merge / overwrite. `architecture.md`, `dependencies.md`, `repos.md` have no AgentOS equivalent — leave them as-is (`/join-project` fills them).

## Step 6: Map specs into the epic/spec structure — the core

**Write each spec to disk as you finish it — do not batch this into a "plan to write later."** For every source spec, run 6a→6e and create the files before moving to the next spec.

For **each** AgentOS spec folder:

### 6a. Choose the target epic
Every spec must land in a known epic. Try to match the spec to an existing epic by name/topic overlap:

- **Unambiguous match** (exactly one clearly-fitting epic) → state your choice and let the user confirm or override.
- **Unknown or ambiguous** (no clear match, or two-plus plausible epics) → **you must ask the user — never guess.** Use AskUserQuestion, one spec at a time, listing all epics as `product / epic`:

```
Spec "2025-04-10-guest-checkout" — which epic does it belong to?

1. rental / checkout-booking-flow   (best guess)
2. rental / search-flow
3. jobs / job-listing-filters
4. Create a new epic under a product

(Choose one)
```

Ask separately for each spec whose epic is unknown — do not batch several unknown specs into one question, and never fall back to a catch-all epic (there is no such bypass — see Gate A). "Create a new epic" → create `products/<product>/epics/<new-slug>/epic.md` using `plan-epic.md`'s `epic.md` shape (H1, `> Product:`, `> Status: planning`, `> Created: <today>`, one-line Summary, empty Specs section).

**One AgentOS spec may become several SoftwareOS specs.** AgentOS specs sometimes bundle independent changes (e.g. "new tab + unrelated stats row"). When a spec covers two-plus unrelated outcomes that belong to different epics — or just deserve separate specs — offer to **split** it: one coherent outcome per spec, each in its right epic. Confirm the split with the user; don't split silently.

### 6b. Create the destination spec folder
```
softwareos/products/<product>/epics/<epic>/specs/<YYYY-MM-DD-slug>/
```
Keep the AgentOS date prefix; slugify the name (lowercase, hyphens, ≤40 chars). If the source folder is v3 with a `HHMM` time component (`YYYY-MM-DD-HHMM-slug`), **drop the time** — SoftwareOS spec folders are date-only (`YYYY-MM-DD-slug`). If that folder already exists (re-run), update it in place instead of duplicating.

### 6c. Translate into SoftwareOS spec.md
Build the SoftwareOS `spec.md` (see `shape-spec.md` → "spec.md Content"): `# {Spec Title}`, then the metadata header (`> Epic: ../../epic.md`, `> Status:` — see below, `> Branch: feat/<epic-slug>/<spec-slug>`), then the sections. Read the source by layout:

**v3 (shape.md + plan.md)** — map only from sections that actually exist in v3:

| Source | SoftwareOS destination |
|---|---|
| `shape.md` `## Scope` | `## Overview` |
| `shape.md` `## Decisions` | `## Technical Approach` (constraints that read as scope limits → `## Out of Scope`) |
| `plan.md` approach / narrative | `## Technical Approach` |
| `shape.md` `## Standards Applied` | `## Standards Applied` (re-link paths to `../../../../../../standards/<area>/<file>.md`) |
| `shape.md` `## Context` → References | `references.md` |
| `shape.md` `## Context` → Visuals | `visuals/` (see 6e) |
| `plan.md` `## Task N` headings | `tasks.md` (see 6d) |

**v3 has no requirements section, so there is no honest source for acceptance criteria. Do NOT synthesise ACs from the scope text** — invented ACs are worse than none, because the qa skill would verify against fiction. Write the section with the pending-marker convention instead:

```
## Acceptance Criteria

_Pending — rerun /shape-spec as PM to fill._
_No acceptance criteria existed in the AgentOS v3 source (shape.md has no
requirements section). Migrated <YYYY-MM-DD>._
```

This degrades correctly downstream — `skills/qa/SKILL.md` handles a spec with no ACs by offering checks-only QA capped at PASS WITH NOTES. `## Goals & User Stories` has no v3 source either; mark it `_Pending_` the same way rather than inventing stories.

**workshop / legacy (spec.md):**

| `spec.md` section | SoftwareOS destination |
|---|---|
| `## Goal` | `## Overview` |
| `## User Stories` | `## Goals & User Stories` |
| `## Specific Requirements` | `## Acceptance Criteria` (numbered `AC`) |
| `## Existing Code to Leverage` | `## Technical Approach` (and/or `references.md`) |
| `## Out of Scope` | `## Out of Scope` |
| `planning/requirements.md` | fold into `## Overview` or save as `references.md` — never discard |

**Determine the spec's state** — done work and future work migrate differently. Use the strongest signal available, in this order:

1. **`tasks.md` checkboxes** (workshop): all `[x]` → done · some `[x]` → in-progress · none → not-started.
2. **`verification/` folder present** (workshop) → strong signal the spec is done.
3. **Cross-check `agent-os/product/roadmap.md`**: if the matching feature is checked `[x]`, treat as done.
4. **Still unknown** (typical for v3, which has no completion markers) → **ask the user per spec**: `done / in-progress / not started?`

Map state → `> Status:` and meaning:

| State | `> Status:` | tasks.md | Meaning after migration |
|---|---|---|---|
| done | `done` | keep `[x]` | Historical record of what was built — no one acts on it. Note in Overview: "Migrated as already-built." |
| in-progress | `in-progress` | keep `[x]`/`[ ]` mix | Work underway; continues on its branch. |
| not-started (future) | `shaped` | all `[ ]` | Real upcoming work — gets its branch and is picked up later. |

**Set the `> Covers:` header — infer, or emit empty and log for backfill.** SoftwareOS specs declare what pages/routes/files they own in a `> Covers:` line. AgentOS has no equivalent, so migration has to either infer the claim or leave it empty and flag it. Do both — infer where the source clearly names scope, and log every empty result for Step 7's backfill list.

- **Inferable** — the source spec plainly names its scope. Common evidence:
  - **v3 `shape.md` `## Scope`** — reads like "the guest-checkout flow" or names a route (`/checkout/guest`). If the scope block reads as one or more concrete routes / pages / paths, carry them into `> Covers:`.
  - **workshop `## Specific Requirements`** — an AC referencing a concrete route/file (`the /admin/reports page shall…`, `src/lib/pricing.ts must…`) — carry those to `> Covers:`.
  - **`plan.md` task headings** in v3, or workshop `tasks.md` — endpoints/files named directly (`POST /api/sessions`, `src/features/checkout/`) — pull them.
  - **Multiple confident candidates** — join them comma-separated on one line. Preserve order and case; don't rewrite paths (a route stays a route, a glob stays a glob).
- **Not inferable** — the source is task-heavy or written in prose that names no concrete scope. **Emit `> Covers: —`** (em-dash means "no claim yet") and **add the spec to the Step 7 backfill list.** Never invent Covers values — an incorrect claim later fires false HALTs in `/shape-spec` Step 4 and false positives in `/spec-of`. `—` is honest and `/refresh-indexes` reports it as drift so the map's state is visible.

Confirm the resolved Covers value with the user before writing it — one AskUserQuestion per spec is fine here; migrated Covers is a claim about ownership that shouldn't slip through unreviewed.

Append a Changelog row recording the migration. Use the registered Type **`created`** (the audit-log skill recognises `created`/`change`/`hotfix` — a new `migrated` type would fall out of the timeline); carry the provenance in the Change column:

```
| <today> | <git user.name> | created | Migrated from agent-os (<source path>/specs/<folder>) | — |
```

### 6d. Translate into SoftwareOS tasks.md
Header `# Tasks — {Spec Title}` + metadata block (`> Epic:`, `> Spec: <YYYY-MM-DD-slug>`, `> Branch: feat/<epic-slug>/<spec-slug>`), then the task list (see `shape-spec.md` → "tasks.md Content"). Source by layout:

- **v3** — `plan.md` lists tasks as `## Task N` headings. **Drop the boilerplate `Task 1: Save spec documentation`** (an artifact of the old save flow), then convert the real implementation tasks. v3 tasks carry no `[x]` state, so all migrate as open `[ ]` unless the user marks otherwise.
- **workshop / legacy** — convert `tasks.md`'s layer-grouped list (`1.0 / 1.1`, grouped Database/API/Frontend/Testing); keep the group headings.

For both: renumber tasks to `T1, T2, T2.1 …` sequentially (a fresh migration assigns fresh T-IDs; append-only only matters afterward), and **preserve completion state** (`[x]` stays `[x]`, `[ ]` stays `[ ]`). Drop any per-group "Acceptance Criteria" prose — it now lives in spec.md.

### 6e. Carry the rest — assets & data
Copy the source `visuals/` (v3: `<spec>/visuals/`; legacy: `planning/visuals/`) → the SoftwareOS spec's `visuals/`. Carry `standards.md` and `references.md` (v3 has these directly) into the spec folder. Note any legacy `verification/` artifacts (screenshots, `final-verification.html`) in `references.md` rather than discarding them.

**What is carried vs. left alone — be explicit in the report:**

| Item | Carried? |
|---|---|
| Spec docs (`shape`/`plan` or `spec`/`tasks`), `standards.md`, `references.md` | **Yes** — translated / copied into the spec folder |
| Images & mockups inside a spec's `visuals/` | **Yes** — copied verbatim into the destination `visuals/` |
| Product docs (`mission`/`roadmap`/`tech-stack`) and `standards/` | **Yes** — per Steps 4–5 |
| Verification screenshots (legacy `verification/`) | Referenced in `references.md` (not silently dropped) |
| **The app's own source code and `src/assets/` (icons, images, fonts, media)** | **No — never touched.** These are not AgentOS artifacts; AgentOS only holds planning docs + optional spec mockups. |
| Runtime data, databases, `.env`, build output | **No — out of scope.** AgentOS never contained these. |

AgentOS has no "data" of its own — it is planning documentation. So migration moves docs (and any spec mockups); it does not move or modify application data, assets, or code.

### 6f. Register the spec in its epic
Writing the spec folder is not enough — the spec must also appear in the `epic.md` a human opens. `/refresh-indexes` (Step 7) regenerates `specs.index.yml` but **never edits `epic.md`** (by design: "It never creates, moves, or deletes any product/epic/spec folder"). So append a row to the target epic's **Specs** table yourself:

```
| <YYYY-MM-DD-slug> | <status> | feat/<epic-slug>/<spec-slug> |
```

For a **split** spec, add one row per resulting spec. For a `done`-status spec the branch never existed, so put `—` in the Branch column (rather than a `feat/…` ref that `/project-status` would render as a dead link).

## Step 7: Indexes + migration report (verification gate)

1. Run the `/refresh-indexes` procedure to regenerate every `products.index.yml`, `epics.index.yml`, and `specs.index.yml` from the tree just written.
2. **Validate the output** — parse each migrated `tasks.md` the way `/project-status` does (metadata header `> Epic:`/`> Spec:`/`> Branch:` in the first lines, `T<n>` IDs, valid state markers). Flag any file that doesn't parse so it's fixed now, not discovered later.
3. Write a **per-source** report at `softwareos/migrations/<YYYY-MM-DD>-<source-slug>.md` (create the `migrations/` folder if needed). One fixed `migration-report.md` would be overwritten on the multi-source loop (Step 2b / join-project), destroying the audit trail and the re-run lookup — so give each source its own file. The report contains:
   - **Source** — the AgentOS path.
   - **Mapping table** — each AgentOS spec → its destination `product / epic / spec`, and its carried status.
   - **Reconciliation table** (from Step 7.5) — inventoried vs on-disk vs skipped.
   - **Product docs & standards** — what moved, what was merged/kept/skipped.
   - **Epic decisions** — the spec→epic choices the user made. On a re-run, read **all** files under `softwareos/migrations/` first and reuse those choices instead of re-asking.
   - **Validation** — pass/fail for each migrated `tasks.md`.
   - **Backup** — the absolute path of the tarball (Step 8).
   - **Gaps for /join-project** — `architecture.md`, `dependencies.md`, `repos.md`, and any product the mapping couldn't infer.
   - **Covers backfill needed** — every migrated spec whose `> Covers:` was emitted as `—` (Step 6c couldn't infer scope). Print each as `<product>/<epic>/<spec-folder>` with a one-line reason (usually "task-heavy source, no concrete scope named"). This section makes the map's blindness auditable rather than silent; the fix is to run `/spec-changes` on each listed spec and set Covers there. If every migrated spec got a non-empty Covers value, print the section with `_None._` instead of omitting it — reviewers should see the check ran.
   - **Leftovers to remove** — the exact paths Step 8 will delete.
4. Present the report and ask the user to confirm before any deletion. (On `--dry-run`, stop here — the report is the deliverable, marked `DRY RUN`; nothing was written or deleted.)

## Step 7.5: Reconcile — the precondition for Step 8

Before the report is presented, reconcile intent against disk. **Never infer this from your own notes about what you did — read the filesystem.**

- `inventoried` — the spec list from Step 2e, after Step 3's filter.
- `written` — destination spec folders that exist on disk **and** contain both `spec.md` and `tasks.md`.
- `skipped` — specs the user explicitly declined, each with the reason they gave.

Render this into the report so the gate is auditable later:

| AgentOS spec | Destination | On disk | Outcome |
|---|---|---|---|
| 2025-04-10-1430-guest-checkout | rental / checkout-flow / 2025-04-10-guest-checkout | spec.md + tasks.md | migrated |
| 2025-05-02-0900-stats-row | — | — | skipped (user: superseded) |

**Guard against the empty set.** If `inventoried` is 0, you did **not** pass through Step 2e (its gate would have aborted) — this is the join-project path reaching here without the gate. Do **not** treat `0 == 0` as a pass. Abort with the Step 2e message. A reconciliation over an empty set is not evidence that a migration happened.

**Step 8 may run only when `inventoried > 0` and `written + skipped == inventoried`.** If anything is unaccounted for, print the delta and stop with the source intact:

```
HOLD — migration incomplete, nothing will be deleted.
Inventoried: 11 · Written: 9 · Skipped: 0 · Unaccounted: 2
  2025-05-02-0900-stats-row      — no destination folder on disk
  2025-06-11-1200-invoice-export — folder exists, tasks.md missing
<source> is untouched. Re-run /migrate-agent-os against the same source — it
picks up where it left off (6b updates in place) — or mark these skipped.
```

A **split** spec counts as migrated only when **all** of its resulting specs are on disk; a partial split is unaccounted.

## Step 8: Remove AgentOS (gated — only after Step 7.5 passes and the user confirms)

**Precondition: Step 7.5 passed** (`written + skipped == inventoried`) **and the user confirmed the report.** If reconciliation is short, you are in `HOLD`, not here.

**Back up first — always.** Before deleting anything, create a timestamped tarball covering **everything on the delete list below** (not just `agent-os/`) at a concrete path **outside the repo root** (e.g. `<repo-parent>/agent-os-backup-<YYYY-MM-DD-HHMM>.tar.gz`, never inside the repo where it could be committed), and record its absolute path in the per-source report. This is non-negotiable when the source is git-untracked or history-less (see the guidelines) — there, the tarball is the *only* way back. Even when the source is tracked, the tarball is cheap insurance.

Once the backup exists, delete AgentOS so there are zero leftovers:

- the `agent-os/` docs folder (the resolved source path),
- `.claude/commands/agent-os/` (the old commands),
- any AgentOS-only agents/hooks the user points out.

Report the final state: what migrated (counts), where it landed, what was removed, and the next step — run `/join-project` to fill the gaps the mapping couldn't, then `/project-status` to confirm.

## Outputs

What the user sees, in order:

1. **Inventory summary** (Step 3) — everything found in the source, before anything changes. Aborts here if there are no specs (Step 2e).
2. **Per-spec epic questions** (Step 6a) — only for specs whose epic is unknown.
3. **`softwareos/migrations/<date>-<source-slug>.md`** (Step 7) — the full mapping + reconciliation + validation, presented for confirmation. Also written on `--dry-run` (marked `DRY RUN`).
4. **Final summary** (Step 8) — counts of what migrated, where it landed, what was removed, and the next step (`/join-project`, then `/project-status`).

## Done when

An AgentOS project has all its specs migrated intact into the epic/spec structure (`written + skipped == inventoried`), each registered in its `epic.md`, standards and product docs carried over, a per-source report written under `softwareos/migrations/`, a tarball backup recorded, and no `agent-os/` or `.claude/commands/agent-os/` leftovers.
