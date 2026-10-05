---
description: Plan an epic — create epic.md plus a PM product brief and/or tech plan under softwareos/products/<product>/epics/
argument-hint: "[epic-name]"
---

# Plan Epic

Create or update an epic in `softwareos/products/<product>/epics/<epic-slug>/`. Always writes `epic.md`; adds `product-brief.md` (PM role), `tech-plan.md` (Tech role), or both. Epics group related specs and give them a shared branch namespace.

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if it succeeds and `<root>/softwareos/` exists, that's the SoftwareOS root. If not a git repo, walk up from cwd looking for `softwareos/`.
2. If not found: tell the user this repo isn't onboarded — run `/plan-customer` (new customer) or the installer (`project-install.sh`) first. Stop.
3. Read `softwareos/config.yml`. If `customer_root` is set, read customer/ecosystem docs from that path instead of locally (if the path doesn't exist on disk, say so and continue with local stubs).
4. Enumerate from the filesystem, never from caches: products = dirs under `softwareos/products/`; epics = dirs under `products/<product>/epics/`; specs = dirs under `products/<product>/epics/<epic>/specs/`.

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **One question at a time** — wait for each answer
- **Offer suggestions** — present options the user can confirm, adjust, or correct
- **The slug is immutable** — it appears in every branch name; confirm it explicitly, never rename it later
- **Never invent facts** — unknown = "TBD"

## Process

### Step 1: Check Existing Epics

First pick the **product** this epic belongs to (list `softwareos/products/*`). Then list epics under `softwareos/products/<product>/epics/`, mentioning them so the user doesn't create a duplicate.

If the argument (or the name given later) matches an existing epic (slug or close title match), use AskUserQuestion:

```
Epic "<epic-slug>" already exists (status: <status> · brief: yes/no · tech plan: yes/no).

1. Update it (add or revise role docs)
2. Create a different epic
3. Cancel
```

Update mode keeps the existing slug — skip slug derivation in Step 3 and only gather content for the docs being added or revised.

**Rename requests:** if the user asks to rename an epic that already has specs or bugs, refuse. The slug is load-bearing — it lives in branch names (`feat/<epic-slug>/<spec-slug>`), tasks.md `> Branch:` metadata, and spec paths. Advise manual migration (new directory, move specs, update branch metadata, rename branches) if they truly must.

### Step 2: Role

Use AskUserQuestion:

```
What's your role for this epic?

1. PM — write the product brief
2. Tech — write the technical plan
3. Both
```

This gates Steps 4 and 5. Either role alone is fine — the other doc stays marked pending in epic.md until someone fills it.

### Step 3: Name & Goal

Skip for update mode (reuse the existing slug and epic.md Summary; confirm they still hold).

**Meeting write-ups first:** list `softwareos/products/<product>/meetings/*.md` and
`softwareos/meetings/*.md` (written by the process-meeting skill). If one covers this epic's subject,
read it — its Feature map, Open questions and "What to build next" table are the best available raw
material for Steps 4, 5c and 5d. Cite its repo-relative path in tech-plan.md's Approach so the
provenance survives.

Use AskUserQuestion:

```
What is the epic and what outcome does it deliver?

(One or two sentences — the name plus the result when it ships)
```

Derive a kebab-case slug from the name: lowercase, hyphens, 2-4 words, **no date prefix**. Confirm explicitly:

```
Proposed epic slug: `checkout-revamp`

This slug is immutable — branches will be named feat/checkout-revamp/<spec-slug>
and it can't be renamed once specs exist.

OK, or adjust?
```

### Step 4: PM Path (role PM or Both)

One question at a time, each via AskUserQuestion.

**4a — Problem & goals:**

```
What problem does this epic solve, and what are the goals?
```

**4b — User stories:**

```
Who does what, and why? Bullets are fine.

(e.g. "As a shopper, I can pay with saved cards so checkout takes one tap")
```

**4c — Success criteria:**

```
How do we know it's done and working?
```

Compile into product-brief.md (template below). Fill `## Out of Scope` from anything the user explicitly excluded in their answers; otherwise "TBD".

### Step 5: Tech Path (role Tech or Both)

One question at a time, each via AskUserQuestion.

**5a — Approach:**

```
What's the technical approach? One paragraph at altitude — major moving parts, not implementation detail.
```

**5b — Architecture impact:** read `softwareos/products/<product>/architecture.md` first (if it exists), then:

```
Current components (from product/architecture.md):
- [list components]

Does this epic change any of these? New services, schema changes, infra?
```

If architecture.md doesn't exist, ask the question without the component list and note that `/plan-product` would document the architecture.

**5c — Risks & unknowns:**

```
What could bite us? Anything that needs a spike before committing?
```

**5d — Candidate specs:** propose 2-5 vertical slices, each independently shippable. For non-trivial epics, dispatch the `planner` agent (Agent tool) with: the epic goal, approach, and architecture impact — ask it to propose 2-5 candidate spec slices with slugs and one-liners. Present for confirmation:

```
Candidate specs (vertical slices, each independently shippable):

1. `<spec-slug>` — <one line>
2. `<spec-slug>` — <one line>
...

Confirm, adjust, or rewrite?
```

These are proposals that seed `/shape-spec` — not commitments. Compile into tech-plan.md (template below).

### Step 6: Confirm & Write

Show a one-screen summary: epic slug, files to create/update, and a line per doc. Confirm before writing.

Then write to `softwareos/products/<product>/epics/<epic-slug>/`:

- **epic.md** — always (template below). New epic: `Status: planning`, `Created:` today. For each role doc NOT written, replace its Documents line with the pending marker.
- **product-brief.md** — if role PM or Both.
- **tech-plan.md** — if role Tech or Both.

Update mode: flip pending markers to real links in epic.md Documents, append the new role to `Roles planned`, and leave the Specs/Bugs sections untouched.

### Step 7: Suggest Next

```
✓ Epic created:

  softwareos/products/<product>/epics/<epic-slug>/epic.md
  softwareos/products/<product>/epics/<epic-slug>/product-brief.md   [if written]
  softwareos/products/<product>/epics/<epic-slug>/tech-plan.md       [if written]

Next: run /shape-spec to shape the first spec.
```

If a role doc is pending, add one line: "Product brief pending — have a PM run /plan-epic on this epic" (or the Tech equivalent).

## Output Structure

```
softwareos/products/<product>/epics/<epic-slug>/
├── epic.md              # always — index of the epic
├── product-brief.md     # PM role
└── tech-plan.md         # Tech role
```

## epic.md Content

```markdown
# <Epic Title>

> Product: ../../mission.md
> Status: planning | active | done
> Created: YYYY-MM-DD · Roles planned: PM, Tech

## Summary

<2-4 sentences>

## Documents

- [Product brief](product-brief.md)
- [Tech plan](tech-plan.md)

## Specs

| Spec | Status | Branch |
|---|---|---|
```

Pending markers — when a role doc wasn't written, its Documents line becomes:

- `- Product brief: pending — run /plan-epic as PM to create`
- `- Tech plan: pending — run /plan-epic as Tech to create`

`Roles planned` lists the roles that have contributed so far; update mode appends.

## product-brief.md Content

```markdown
# <Epic Title> — Product Brief

> Epic: epic.md · Product: ../../mission.md

## Goals

[Problem and goals — from Step 4a]

## User Stories

- [Stories — from Step 4b]

## Success Criteria

- [How we know it's done and working — from Step 4c]

## Out of Scope

- [Explicit exclusions, or "TBD"]
```

## tech-plan.md Content

```markdown
# <Epic Title> — Tech Plan

> Epic: epic.md · Product: ../../mission.md

## Approach

[One paragraph at altitude — from Step 5a]

## Architecture Impact

[Components touched, new services, schema changes, infra — from Step 5b]

## Risks & Unknowns

- [Risks, open questions, spikes needed — from Step 5c]

## Candidate Specs

- `<spec-slug>` — <one-line slice description>
- `<spec-slug>` — <one-line slice description>
```

## Tips

- **Epics are containers** — keep them at outcome level; detail belongs in specs.
- **Pick a short slug** — it appears in every branch name; recognizable beats descriptive.
- **One role at a time is normal** — a PM creates the epic with a brief; Tech reruns /plan-epic later to add the plan. The pending marker keeps the gap visible.
- **Candidate specs are cheap** — list the slices now; /shape-spec is where each one gets real.
