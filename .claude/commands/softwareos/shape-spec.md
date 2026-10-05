---
description: Shape a spec inside an epic — spec.md as single source of truth, plus tasks.md for Tech work
argument-hint: "[epic-slug]"
---

# Shape Spec

Gather context and shape a spec inside an epic. Produces `spec.md` — the single source of truth for this work — and, for Tech roles, `tasks.md`. **Run this command while in plan mode.**

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if it succeeds and `<root>/softwareos/` exists, that's the SoftwareOS root. If not a git repo, walk up from cwd looking for `softwareos/`.
2. If not found: tell the user this repo isn't onboarded — run `/plan-customer` (new customer) or the installer (`project-install.sh`) first. Stop.
3. Read `softwareos/config.yml`. If `customer_root` is set, read customer/ecosystem docs from that path instead of locally (if the path doesn't exist on disk, say so and continue with local stubs).
4. Resolve `mode:` per `/go-production` → [Reading the mode](./go-production.md#reading-the-mode). It controls Step 11 (test mode + mandatory verification tasks) and Step 13. Carry it through the whole run.
5. Enumerate from the filesystem, never from caches: products = dirs under `softwareos/products/`; epics = dirs under `products/<product>/epics/`; specs = dirs under `products/<product>/epics/<epic>/specs/`. (Legacy flat `softwareos/epics/<epic>/specs/` may still exist in older projects — read it too.)

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **One question at a time** — wait for each answer
- **Offer suggestions** — Present options the user can confirm, adjust, or correct
- **Keep it lightweight** — This is shaping, not exhaustive documentation

## Prerequisites

This command **must be run in plan mode**.

**Before proceeding, check if you are currently in plan mode.**

If NOT in plan mode, **stop immediately** and tell the user:

```
Shape-spec must be run in plan mode. Please enter plan mode first, then run /shape-spec again.
```

Do not proceed with any steps below until confirmed to be in plan mode.

## Process

### Step 1: Choose the Product & Epic

Enumerate epics across all products — dirs under `softwareos/products/*/epics/*` (plus legacy flat `softwareos/epics/*` if present). Use AskUserQuestion, listing each as `product / epic`:

```
Which epic does this spec belong to?

1. rental / checkout-booking-flow (planning)
2. rental / search-flow (planning)
3. jobs / job-listing-filters (planning)
4. Create a new epic

(Choose one)
```

If an epic slug was passed as an argument and matches exactly one `products/<product>/epics/<epic-slug>/`, use it (ask which product if the slug is ambiguous across products).

If the user picks "create a new epic", or no epics exist: tell them to run `/plan-epic` first, then **stop**.

Once a product + epic is chosen, read the epic's docs (under `softwareos/products/<product>/`) to ground the spec:
- `epics/<epic>/epic.md` — status, summary, existing specs
- `epics/<epic>/product-brief.md` — goals, stories, success criteria (if present)
- `epics/<epic>/tech-plan.md` — approach, candidate specs (if present)

If `tech-plan.md` is missing, proceed anyway — note it in the spec.md Overview so the gap is visible.

### Step 2: Confirm Your Role

Use AskUserQuestion:

```
What's your role for this spec?

1. PM — fills Goals & User Stories + Acceptance Criteria
2. Tech — fills Technical Approach + generates tasks.md
3. Both — fills everything

(Choose 1, 2, or 3)
```

Sections owned by the other role are still written to spec.md, marked:
`_Pending — rerun /shape-spec as <role> to fill._`

### Step 3: Clarify What We're Building

Use AskUserQuestion to understand the scope, grounded in the epic. If the tech plan lists Candidate Specs, offer them as suggestions:

```
Which part of <epic> is this spec? Describe the feature or change.

Candidate specs from the tech plan:
1. [candidate 1]
2. [candidate 2]

(Pick one, or describe something else — I'll ask follow-up questions if needed)
```

Based on their response, ask 1-2 clarifying questions if the scope is unclear. Examples:
- "Is this a new feature or a change to existing functionality?"
- "What's the expected outcome when this is done?"
- "Are there any constraints or requirements I should know about?"

**Existing-spec check:** scan `products/<product>/epics/<epic>/specs/` for a folder that already covers this scope (matching slug or title). This is a **name-based** check only; a coverage-based check over what each spec actually owns runs in Step 4. If found, use AskUserQuestion:

```
This looks like the existing spec specs/<folder>/. Its <PM/Tech> sections are pending.

1. Complete the pending sections in that spec (recommended)
2. Create a new spec anyway

(Choose 1 or 2)
```

If completing an existing spec: keep its folder and filled sections, fill only the sections pending for your role, generate tasks.md if role is Tech/Both and it doesn't exist, and append a Changelog row (Type `change`, e.g. "Tech sections + tasks.md added"). Then continue from Step 5 — Step 9's folder creation is skipped.

### Step 4: Pre-Flight Integrity Check

Every spec declares what it **owns** — the pages, routes, and code paths it is responsible for — in its `> Covers:` header line. `/refresh-indexes` mirrors that into each epic's `specs.index.yml` as a `covers:` list. Before drafting anything new, check that map so shaping never silently forks an area another spec already owns. (`/spec-of <area>` queries the same map in the reverse direction.)

This step is **read-only** (index reads, spec.md scans, AskUserQuestion) and is safe in plan mode.

**4a — Collect coverage candidates.** Use AskUserQuestion:

```
What will this spec own? List the pages, routes, or code paths it touches.

Examples:
- /checkout, /checkout/guest
- src/features/checkout/**
- src/lib/pricing.ts

(List them, or say "unsure" and I'll infer from what we discussed)
```

If the user is unsure, infer candidates from the scope described in Step 3 (reference paths from Step 6 aren't gathered yet) and present the inferred list for confirmation. Normalize: trim each value, de-dupe, keep case as written.

**4b — Choose the search scope.** Use AskUserQuestion:

```
Might this area repeat in other epics or products?

1. No — search only this epic
2. Yes / Unsure — search across all products and epics (recommended when in doubt)

(Choose 1 or 2)
```

**4c — Execute the search.**

- Scope = **epic** → read only `products/<product>/epics/<epic>/specs.index.yml`.
- Scope = **cross** → glob `softwareos/products/*/epics/*/specs.index.yml`, plus legacy flat `softwareos/epics/*/specs.index.yml` (same products-first / legacy-fallback pattern as Step 1).

Apply [the match rules](./spec-of.md#the-match-rules) with each candidate `C` as the query — `/spec-of` and `/shape-spec` share the ranked rule set so the forward and reverse directions agree. The canonical definition (rules 1–5, ordering, ranking-within-tier) lives in `/spec-of` → `## The match rules`; do not duplicate it here.

If nothing matches at all, say nothing and continue to Step 5 — 4d and 4e are skipped.

**4d — Confirm the match is relevant.** A path or route can collide by coincidence, and a weak body-scan hit is a guess. Before deciding anything, show the user what was found and let them judge it. For each match, print its path, title, one-line Overview summary, the matched value, and the tier, then use AskUserQuestion:

```
Found a spec that may already own this area:

rental / checkout-booking-flow / 2026-07-30-guest-checkout   [strong: /checkout/guest]
"Guest checkout without account creation."

Is this the same area you're about to spec?

1. Yes — it's the same area
2. No — different concern, the paths just overlap
3. No — but a different spec owns this; let me point you to it

(Choose one)
```

Handle each answer:

- **Yes** → keep it as a confirmed overlap; it goes into the 4e decision.
- **No, different concern** → drop it. Note the false positive in `references.md` under **Related Specs** as `[Considered]` with the user's reason — the next person shaping in this area sees the recorded reasoning and can dismiss the same match in seconds instead of re-litigating it. (Step 4c doesn't currently read other specs' `references.md`, so the entry is a note-to-future-self, not a functional suppression — if the same weak match surfaces again next session, the reasoning is already written down.) If dropping this match leaves no confirmed overlaps, skip 4e and continue to Step 5.
- **No, a different spec owns this** → ask which one:

  ```
  Which spec owns this area?

  (Name it as <product>/<epic>/<spec-folder>, paste its path, or give me keywords
  and I'll search)
  ```

  Resolve the answer against the filesystem — search spec folder names, titles, and `spec.md` bodies across all products and epics, not just the current one. If it resolves to exactly one spec, confirm it back to the user and treat it as a confirmed overlap in 4e. If it resolves to several, list them and ask which. If it resolves to none, say so and offer to continue with the original match or drop it.

  **A referral is a signal the map is stale**: the search missed that spec because its `> Covers:` line doesn't list this area. Offer to fix it:

  ```
  2026-05-01-price-engine doesn't list `src/lib/pricing.ts` in its `> Covers:` line,
  which is why the search missed it.

  1. Add it to that spec's Covers: (recommended — future lookups will find it)
  2. Leave it alone

  (Choose 1 or 2)
  ```

  If they choose 1, add it to that spec's `> Covers:` line in Task 1 with a Changelog row of Type `change` noting `Backfilled covers with <value>` — that write happens at execution time, not now, so this step stays read-only.

Ask about matches one at a time, strongest first. With more than three matches, confirm the strong ones individually and present the weak ones as a single list the user can accept or dismiss wholesale.

**4e — HALT on any confirmed overlap.** Do not draft. List each confirmed overlap with its path, title, the matched value, and the tier (strong/weak), then use AskUserQuestion:

```
This overlaps existing coverage:

A. rental / checkout-booking-flow / 2026-07-30-guest-checkout — [strong] /checkout matches /checkout/guest
B. jobs / pricing / 2026-05-01-price-engine — [weak] "src/lib/pricing.ts" found in spec.md body

1. Extend A — add this scope to that spec instead of creating a new one
2. Extend B — same, for B
3. Create anyway — keep them separate and record the relationship
4. Cancel — let me rethink the scope

(Choose one)
```

AskUserQuestion allows at most 4 options: when there are more than two confirmed overlaps, offer Extend for the two strongest and note the rest in the prompt text (the user can still name one via "Other"). Strong matches rank above weak ones; a spec the user named in 4d ranks as strong regardless of how it was found.

If 4d dismissed every match, continue to Step 5 as though nothing was found.

**4f — On Extend.** Set `extend_target = <product>/<epic>/<spec-folder>` and load that spec's Overview + Acceptance Criteria as context for the rest of shaping. Then:

- Skip Step 9's folder creation (same as the Step 3 completing-an-existing-spec path).
- In Step 10, edit the existing `spec.md`: union the new candidates into its `> Covers:` line and append a Changelog row of Type `change` with the note `Extended covers with <new values>`.
- **In Step 11, never regenerate `tasks.md` on extend.** If the target already has `tasks.md`, append the new work as fresh task IDs continuing from the highest existing `T<n>`, leaving every existing ID and state untouched (task IDs are append-only — branches, PR bodies, and Changelog rows already reference them). Only generate a new `tasks.md` when the target doesn't have one, using the same guard as Step 3's completing-an-existing-spec path.
- **In `production` mode, extend the Verification group deliberately.** The three parts (unit tests, security review, QA) are mandatory. Decide explicitly whether the target's existing Verification tasks cover the added scope, or whether the new scope needs its own testing / security-review tasks appended. Silently inheriting the old group means the new work ships unverified.
- Record the relationship in `references.md` under **Related Specs** (see template).

**4g — On Create anyway.** Set `related_specs = [<paths of the overlaps>]` and capture one sentence per overlap on *why* it stays separate. These land in `references.md` under **Related Specs**.

**4h — On Cancel.** Return to Step 3 and re-clarify the scope, then run Step 4 again.

Whatever the outcome, the confirmed candidate list becomes this spec's `> Covers:` value in Step 10.

### Step 5: Gather Visuals

Use AskUserQuestion:

```
Do you have any visuals to reference?

- Mockups or wireframes
- Screenshots of similar features
- Examples from other apps

(Paste images, share file paths, or say "none")
```

If visuals are provided, note them for inclusion in the spec folder.

### Step 6: Identify Reference Implementations

Use AskUserQuestion:

```
Is there similar code in this codebase I should reference?

Examples:
- "The comments feature is similar to what we're building"
- "Look at how src/features/notifications/ handles real-time updates"
- "No existing references"

(Point me to files, folders, or features to study)
```

If references are provided, read and analyze them to inform the plan. For large or unfamiliar areas, dispatch the `code-explorer` agent (Agent tool) with: the paths or features to trace and which patterns to extract for this spec.

Also check `softwareos/products/<product>/meetings/*.md` and `softwareos/meetings/*.md` (written by the process-meeting skill) for a write-up covering this scope. If one exists, read it — its End-to-end flow and Decisions ground the Technical Approach, its Open questions belong in Out of Scope or the ACs, and its Symmetry implications are the cheapest bug prevention available. Record its path in references.md.

**Re-check the ownership map for anything code-explorer surfaced.** Step 4a asked the user to list paths this spec will own, but at that point nobody knows which files are actually involved — `code-explorer` finds them here. Diff what this step surfaced (specific files, module paths, entry points) against the candidate list from Step 4a. For every newly-discovered path, silently re-run [Step 4c](#step-4-pre-flight-integrity-check) against just those paths — same rules, same scope. If nothing matches, say nothing and continue. If a match hits, treat it exactly like a Step 4c hit: run 4d (confirm relevance) and, if confirmed, 4e (HALT with Extend / Create anyway / Cancel). The user only sees a prompt when the recheck actually finds something.

### Step 7: Check Epic & Product Alignment

Read the epic's `product-brief.md` (success criteria) and `softwareos/products/<product>/mission.md` if they exist, then use AskUserQuestion:

```
Does this spec serve the epic's success criteria?

From <epic>'s brief:
- [relevant success criteria]

From the product mission:
- [relevant points]

(Confirm alignment or note any adjustments — these land in the spec's Overview)
```

If neither document exists, skip this step.

### Step 8: Surface Relevant Standards

Read `softwareos/standards/index.yml` to identify relevant standards based on the feature being built.

Use AskUserQuestion to confirm:

```
Based on what we're building, these standards may apply:

1. **api/response-format** — API response envelope structure
2. **api/error-handling** — Error codes and exception handling
3. **database/migrations** — Migration patterns

Should I include these in the spec? (yes / adjust: remove 3, add frontend/forms)
```

Read the confirmed standards files to include their content in the plan context.

### Step 9: Generate Spec Folder Name

Create the folder using this format:
```
softwareos/products/<product-slug>/epics/<epic-slug>/specs/YYYY-MM-DD-<spec-slug>/
```

Where:
- Date is today (no time component)
- Spec slug is derived from the feature description (lowercase, hyphens, max 40 chars)

Example: `softwareos/products/rental/epics/checkout-booking-flow/specs/2026-06-11-guest-checkout/`

If a folder with the same date and slug already exists, ask the user to disambiguate the slug.

The canonical branch is derived from the slugs (spec slug WITHOUT the date prefix):
`feat/<epic-slug>/<spec-slug>` — e.g. `feat/checkout-revamp/guest-checkout`.

**Note:** If `products/<product>/epics/<epic>/specs/` doesn't exist, create it when saving the spec folder.

### Step 10: Draft spec.md

Build spec.md from the template below using everything gathered. Fill the sections your role owns; mark the rest pending. The `> Covers:` line carries the confirmed candidate list from Step 4 (`—` if it's empty). Author for the Changelog comes from `git config user.name` (ask if unset).

If `extend_target` was set in Step 4f, don't draft a new file: open that spec's `spec.md`, union the new candidates into its `> Covers:` line, extend the affected sections, and append a Changelog row of Type `change` noting `Extended covers with <new values>`.

Show the full draft and confirm:

```
Here's the spec draft:

[full spec.md content]

Look right? (approve / adjust: ...)
```

### Step 11: Generate tasks.md (Tech and Both only)

If role is PM: skip this step — no tasks.md is created.

First establish the **test mode**. What you ask depends on the project mode from Step 0.4.

**In `setup` mode** — TDD isn't always warranted, so ask. Use AskUserQuestion:

```
Should this spec include automated tests?

1. TDD — write failing tests first, then implement (best for logic-heavy work)
2. Tests after implementation
3. No automated tests — verify via QA only

(Choose one)
```

Record the answer as the test mode (`tdd` / `after` / `none`).

**In `production` mode** — `none` is not available. Don't ask whether to test; ask only *when*:

```
This project is in production mode, so automated tests are required.

1. TDD — write failing tests first, then implement (recommended)
2. Tests after implementation

(Choose one)
```

Say the mode is what removed the third option — never silently drop a documented choice. If the user pushes for no tests, tell them that's a `/go-production --revert` decision (or a waiver at the project level), not a per-spec one, and keep the mode's requirement.

The test mode controls the Verification tasks here and the execution suggestion in Step 13. The qa-skill check against acceptance criteria is included in every mode.

**Production mode also makes acceptance criteria load-bearing:** the qa skill can no longer pass a spec without them. If the role is Tech and the PM sections are still pending, warn here that QA will fail until someone reruns `/shape-spec` as PM.

For non-trivial specs, dispatch the `planner` agent (Agent tool) with: the approved spec.md draft, the epic's tech-plan.md, the reference notes, the chosen **test mode**, and the **project mode** from Step 0.4; ask it to return a tasks.md following the grammar below. When `extend_target` or `related_specs` is set (Step 4), also pass those specs' Overview sections and their `covers` values so the agent plans around the boundary instead of duplicating work. Draft it yourself only for small specs.

Pass the project mode explicitly — the planner reads `config.yml` itself as a fallback, but in `production` it changes what the test tasks are expected to cover (every AC, error paths and boundaries, mapping comments the qa skill and `/go-production` trace), not merely whether a test task exists. Check its output for the three-part Verification group before showing it to the user.

Task rules:
- Every task specific and independently actionable — name the file/module/endpoint where possible
- One deliverable per task
- Always include a qa-skill verification task. Include a testing-skill task only when the test mode is `tdd` or `after`; omit it when the mode is `none`.
- Metadata block carries the canonical branch
- IDs `T<n>` / `T<n>.<m>` are append-only — never renumbered

**In `production` mode the Verification group is mandatory and has three parts** — a unit-test task, a security-review task, and the QA task. The security-review task names the sensitive surfaces this spec touches (auth, payments, user input, file upload, crypto); if it touches none, still include it scoped to the spec's diff, since production-mode `/code-review` dispatches the `security-reviewer` agent unconditionally. Never omit or collapse these three, and never mark them cancelled `[-]` to dodge the gate.

Present the full list for approval:

```
Here's the task list for <spec title>:

[full tasks.md content]

Approve, or adjust? (approve / adjust: add X, drop T4, split T2)
```

Loop until approved.

### Step 12: Structure the Plan

Now build the plan with **Task 1 always being "Save spec documentation"**.

Present this structure to the user:

```
Here's the plan structure. Task 1 saves all our shaping work before implementation begins.

---

## Task 1: Save Spec Documentation

Create `softwareos/products/<product>/epics/<epic>/specs/<folder>/` with:

- **spec.md** — The single source of truth (drafted in Step 10)
- **tasks.md** — Task list (Tech/Both only, approved in Step 11)
- **standards.md** — Relevant standards that apply to this work
- **references.md** — Pointers to reference implementations studied, plus Related Specs from Step 4
- **visuals/** — Any mockups or screenshots provided

Then update `products/<product>/epics/<epic>/epic.md` Specs table:
| <folder> | shaped | feat/<epic-slug>/<spec-slug> |
and regenerate `products/<product>/epics/<epic>/specs.index.yml` to add the new spec — including its `covers:` list (per the `/refresh-indexes` convention).

## Task 2..N: [implementation tasks, mirroring T1, T2, ... from tasks.md]

---

Does this plan structure look right?
```

If `extend_target` was set in Step 4f, Task 1 creates no folder: it edits the existing spec's `spec.md` (+ `references.md`) in place and **updates** that spec's existing `specs.index.yml` entry rather than appending a new one.

If the user approved a `> Covers:` backfill for a spec they named in Step 4d, Task 1 also edits that spec's `spec.md` (its `> Covers:` line + a Changelog row) and its epic's `specs.index.yml` — list it explicitly in the plan, since it's a write outside this spec's folder.

For PM-only specs the plan is just Task 1 (save docs + update epic.md) — implementation starts when Tech reruns /shape-spec.

### Step 13: Ready for Execution

When the full plan is ready:

```
Spec shaped (mode: <setup|production>). When you approve and execute:

1. The spec folder is saved and the epic's Specs table updated
2. Next: create branch feat/<epic-slug>/<spec-slug> and start with T1
   {test mode = tdd → "— or run the testing skill first to write failing tests (TDD)"}

Ready to start? (approve / adjust)
```

Tailor line 2 to the test mode from Step 11: `tdd` → suggest the testing skill first; `after` → note tests are written alongside implementation; `none` → omit any test mention.

In `production` mode, add one line naming the gates that will now hold this spec: `/verify` fails while verification tasks are open, and the pr preflight needs a passing `qa-report.md` plus a recorded review. Git isn't gated — commit and push normally.

## Output Structure

```
softwareos/products/<product-slug>/epics/<epic-slug>/specs/YYYY-MM-DD-<spec-slug>/
├── spec.md           # Single source of truth
├── tasks.md          # Only if role is Tech or Both
├── standards.md      # Which standards apply and key points
├── references.md     # Pointers to similar code
└── visuals/          # Mockups, screenshots (if any)
```

## spec.md Content

```markdown
# {Spec Title}

> Epic: ../../epic.md
> Status: shaped
> Branch: feat/<epic-slug>/<spec-slug>
> Covers: /checkout, /checkout/guest, src/features/checkout/**

## Overview

[Always filled — what this spec delivers and how it fits the epic. Note here if the epic has no tech plan yet.]

## Goals & User Stories

[PM section. If shaped as Tech: _Pending — rerun /shape-spec as PM to fill._]

## Acceptance Criteria

[PM section — numbered list; the qa skill keys off these.]
1. AC1: ...
2. AC2: ...

## Technical Approach

[Tech section. If shaped as PM: _Pending — rerun /shape-spec as Tech to fill._]

## Out of Scope

[Both roles — what we're explicitly not doing.]

## Standards Applied

- [api/response-format](../../../../../../standards/api/response-format.md) — why it applies

## Changelog

| Date | Author | Type | Change | Ref |
|---|---|---|---|---|
| YYYY-MM-DD | <git user.name> | created | Initial shaping | — |
```

Status flows `shaped → in-progress → done`. Bugs and change requests update this file in place (`/hotfix`, `/spec-changes`) with Changelog rows — never a new doc.

`> Covers:` is this spec's **ownership claim** — the routes, pages, path globs, and modules it is responsible for, comma-separated. Write `—` when the spec owns no addressable area. `/refresh-indexes` mirrors it into the epic's `specs.index.yml` as `covers:`; Step 4 reads that map to stop two specs claiming the same area, and `/spec-of <area>` reads it to answer the reverse question. Keep it current: when a spec grows to cover a new route or module, extend this line and add a Changelog row.

## tasks.md Content

```markdown
# Tasks — {Spec Title}

> Epic: <epic-slug>
> Spec: <YYYY-MM-DD-spec-slug>
> Branch: feat/<epic-slug>/<spec-slug>

## {Group heading — organizational only}

- [ ] T1 Add guest_sessions table migration (db/migrations/)
- [ ] T2 Implement POST /api/checkout/guest endpoint
- [ ] T2.1 Validate email + cart payload

## Verification

- [ ] T3 Write tests for guest checkout flow (testing skill)   # only when test mode is tdd/after
- [ ] T4 Run QA against acceptance criteria (qa skill)
```

In `production` mode the Verification group is always all three:

```markdown
## Verification

- [ ] T3 Write unit tests for guest checkout flow (testing skill)
- [ ] T4 Security review of the guest-session + payment path (security-reviewer agent)
- [ ] T5 Run QA against acceptance criteria (qa skill)
```

Grammar: states ` `=open, `x`=done, `~`=in-progress, `-`=cancelled · optional trailing `@github-handle` assignee · IDs append-only, never renumbered.

The metadata block also carries review records once they exist — `> Reviewed:` and `> SecurityReviewed:`, written by `/code-review`. Don't pre-write them at shaping time; they're evidence, not intent. All `> Key:` lines must stay within the file's first 15 lines, which every parser depends on.

## standards.md Content

Include the full content of each relevant standard:

```markdown
# Standards for {Feature Name}

The following standards apply to this work.

---

## api/response-format

[Full content of the standard file]

---

## api/error-handling

[Full content of the standard file]
```

## references.md Content

```markdown
# References for {Feature Name}

## Related Specs

<!-- Populated by /shape-spec Step 4 (Pre-Flight Integrity Check). Extended, kept-separate, and dismissed overlaps all land here. Write _None._ when there were no overlaps. -->

- **[Extended]** [2026-07-30-guest-checkout](../2026-07-30-guest-checkout/spec.md) — this spec extends that one's coverage of `/checkout`.
- **[Related]** [../../../../jobs/epics/pricing/specs/2026-05-01-price-engine/spec.md](../../../../jobs/epics/pricing/specs/2026-05-01-price-engine/spec.md) — overlaps on `src/lib/pricing.ts`; kept separate because {reason}.
- **[Considered]** [2026-03-11-admin-audit](../2026-03-11-admin-audit/spec.md) — matched on `src/lib/`, dismissed in Step 4d: {reason it's a different concern}.

## Upstream Meeting

- `softwareos/products/<product>/meetings/YYYY-MM-DD-<slug>.md` — what it grounded (omit if none)

## Similar Implementations

### {Reference 1 name}

- **Location:** `src/features/comments/`
- **Relevance:** [Why this is relevant]
- **Key patterns:** [What to borrow from this]

### {Reference 2 name}

...
```

## Tips

- **Keep shaping fast** — Don't over-document. Capture enough to start, refine as you build.
- **Visuals are optional** — Not every feature needs mockups.
- **Standards guide, not dictate** — They inform the plan but aren't always mandatory.
- **Roles compose** — A PM can shape first; Tech reruns /shape-spec later, picks the same spec, and fills Technical Approach + tasks.md (or vice versa).
- **Mode is project-wide, not per-spec** — you can't shape a "quick, untested" spec in a production project. That's `/go-production --revert` or a recorded waiver, deliberately.
- **The spec is the single source of truth** — Months later, someone reads spec.md and gets the current truth, with the Changelog as the audit trail.
