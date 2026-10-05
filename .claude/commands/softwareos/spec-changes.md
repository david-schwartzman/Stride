---
description: Apply a change request to an existing spec — edit spec.md in place with an audit trail, then reconcile tasks.md
argument-hint: "[epic/spec or keywords]"
---

# Spec Changes

Update an existing spec to reflect a change request. The spec is the single source of truth — it is edited **in place** (never duplicated into a new spec), every change gets a Changelog row, and tasks.md is reconciled without ever renumbering task IDs.

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if it succeeds and `<root>/softwareos/` exists, that's the SoftwareOS root. If not a git repo, walk up from cwd looking for `softwareos/`.
2. If not found: tell the user this repo isn't onboarded — run `/plan-customer` (new customer) or the installer (`project-install.sh`) first. Stop.
3. Read `softwareos/config.yml`. If `customer_root` is set, read customer/ecosystem docs from that path instead of locally (if the path doesn't exist on disk, say so and continue with local stubs).
4. Enumerate from the filesystem, never from caches: products = dirs under `softwareos/products/`; epics = dirs under `products/<product>/epics/`; specs = dirs under `products/<product>/epics/<epic>/specs/` (also read legacy flat `softwareos/epics/<epic>/specs/`).

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **One question at a time** — wait for each answer
- **Edit in place** — never create a new spec for a change; the original spec stays the single source of truth
- **Show before/after** — never apply spec edits the user hasn't seen
- **Task IDs are append-only** — new tasks get the next IDs; NEVER renumber existing tasks

## Process

### Step 1: Locate the Spec

**If an argument was given:**
- `<epic>/<spec>` form → validate that some `softwareos/products/*/epics/<epic>/specs/` (or legacy `softwareos/epics/<epic>/specs/`) contains a folder matching `<spec>` (with or without date prefix). If valid, confirm and proceed.
- Keywords → grep spec titles and `## Overview` sections across `products/*/epics/*/specs/*/spec.md` (and legacy `epics/*/specs/*/spec.md`); present the top matches via AskUserQuestion and let the user pick.

**If no argument (or no match):** ask two questions, one at a time.

```
Which epic is the spec in?

1. <epic-slug> — <epic title>
2. <epic-slug> — <epic title>
...
```

Then:

```
Which spec is changing?

1. <YYYY-MM-DD-spec-slug> — <spec title> (Status: <status>)
2. ...
```

Read the chosen `spec.md` fully (and `tasks.md` if present) before continuing.

**If spec Status is `done`:** warn before anything else:

```
This spec is marked done. Applying a change reopens work — Status will be
set back to in-progress. Continue? (yes / no)
```

Stop on no. On yes, plan to flip `> Status:` to `in-progress` as part of the edit.

### Step 2: What's Changing

Use AskUserQuestion:

```
What's changing in this spec?

(Describe the change — new requirement, dropped requirement, altered
behavior, revised acceptance criteria, etc.)
```

Then, as a **separate** question:

```
Why is this changing?

(One line for the audit trail — e.g. "client moved launch to EU first",
"API limit discovered during build")
```

**Scope check:** if the change is really a new feature rather than an amendment (new user-facing capability, new vertical slice, would more than double the spec's scope), recommend shaping a new spec instead:

```
This looks like new scope rather than a change to this spec. I recommend
running /shape-spec to create a new spec for it, and I'll add a Changelog
note here linking forward. Proceed that way? (new spec / amend this spec anyway)
```

If they choose new spec:

1. Ask which routes/paths from this spec's `> Covers:` line move out with the split. Show the current line and let the user list the ones leaving. Any listed value that isn't in the current Covers line is flagged (typo or already gone) — confirm before proceeding.
2. Edit this spec's `> Covers:` line to remove those values (write `—` if the result would be empty).
3. Append a Changelog row: Type=change, Change="Scope split: <summary> moved to new spec — removed from Covers: <comma-separated values>", Ref=link once the new spec exists.
4. Report and stop.

Updating Covers **now** — rather than deferring to the new spec's `/shape-spec` run — is what keeps the ownership map coherent. If Covers stays as-is, `/shape-spec` Step 4 will HALT on the moved routes as an overlap and the user has to un-tangle the map manually. Better to record the transfer at the exact moment the split is decided.

### Step 3: Propose Edits (Before/After)

Identify every affected section of spec.md (Overview, Goals & User Stories, Acceptance Criteria, Technical Approach, Out of Scope, Standards Applied) **and the `> Covers:` header line**. For each, show the change.

**When to touch `> Covers:`:** it declares what the spec owns. Update it whenever the change adds, removes, or reshapes the pages, routes, files, or modules the spec is responsible for — commonly triggered by edits to Acceptance Criteria, Technical Approach, or Out of Scope. Editorial changes (typos, wording, clarifications with no scope shift) leave it alone. If the change moves a route/path to a different spec, remove it here now — the scope-split path in Step 2 handles the full transfer flow.

For each section, show the change:

```
Proposed edits to <epic>/<spec>:

> Covers:
BEFORE:
  /checkout, /checkout/guest, src/features/checkout/**
AFTER:
  /checkout, /checkout/guest, /checkout/api, src/features/checkout/**

## Acceptance Criteria
BEFORE:
  AC3: Export supports CSV only
AFTER:
  AC3: Export supports CSV and XLSX

## Technical Approach
BEFORE:
  [current text]
AFTER:
  [revised text]

Apply these edits? (apply / adjust: <what to change> / cancel)
```

Omit the `> Covers:` block from the diff when the change is editorial (no scope shift).

Loop on "adjust" until approved. Stop on cancel — nothing written.

### Step 4: Apply + Changelog

Determine the author: run `git config user.name`; if unset, ask the user for their name.

Apply the approved edits, set Status to `in-progress` if Step 1 flagged a reopen, and append one row to the spec's Changelog table:

```markdown
| YYYY-MM-DD | <author> | change | <what changed> — <why, from Step 2> | <ref or —> |
```

Ref is `—` unless the change traces to something concrete (an external ticket, a forward link to a new spec).

### Step 5: Tasks Impact

Skip this step if the spec has no tasks.md (PM-only spec). Otherwise use AskUserQuestion:

```
Does this change affect tasks.md? For each affected task we can:

- add — new work the change introduces
- modify — reword an existing open task
- obsolete — work the change cancels

(Describe the impact, or "no task changes")
```

Apply these rules exactly:

- **Add** — append new tasks with the next available IDs (continue from the highest existing `T<n>`; subtasks continue `T<n>.<m>`). NEVER renumber or reuse IDs.
- **Modify** — reword open (`[ ]`) or in-progress (`[~]`) tasks in place; ID and state unchanged.
- **Obsolete** — flip to `[-]` and append `(cancelled — <reason>, see Changelog YYYY-MM-DD)` using today's changelog date. Never delete the line.
- **Done but invalidated** — if a `[x]` task's output is invalidated by the change, flag it explicitly and ask before touching it:

```
T4 is done, but this change invalidates it (<why>). Reopen it as
in-progress [~]? (yes / leave as done)
```

Only flip `[x]` → `[~]` on confirmation.

If new work needs verification, include explicit verification tasks (testing skill, qa skill) among the additions. Present the resulting tasks.md diff for approval before writing.

### Step 6: Evidence Impact

A spec change can invalidate the evidence that the spec was already satisfied: `qa-report.md` was written against the **old** acceptance criteria, and `> Reviewed:` in `tasks.md` records a review of code against the **old** technical approach. Left alone, both keep reading green while the spec has moved underneath them — and in `production` mode they're exactly what `/verify` and the pr preflight check. This step keeps the evidence honest.

**Evidence is marked stale, never deleted.** A deleted report loses the history of what was verified and when; a stale one says "this happened, and it no longer covers the current spec."

Decide what the edits from Step 3 touched:

| Section changed | Effect | Why |
|---|---|---|
| **Acceptance Criteria** | QA stale · review stale | The contract changed — the report verified different promises, and the reviewer checked alignment against them |
| **Technical Approach** | review stale · QA stale *if behavior changed* | The review was against the old approach |
| **Goals & User Stories** | QA stale | ACs derive from these; the report's evidence may no longer be the point |
| **Out of Scope** | review stale *only if scope widened* | Newly in-scope work was never reviewed |
| **Overview / Standards Applied** | none by default | Usually editorial; ask if the standards set actually changed |

Two overrides on that table, both stronger signals than the section list:

- **Tasks were added or reopened in Step 5** → both QA and review are stale regardless of section. New or redone work has been neither tested nor reviewed.
- **The change is purely editorial** (wording, typos, clarifying text with no change to what the code must do) → nothing is stale. Say so and skip the rest of this step.

Present the conclusion and let the user overrule it:

```
This change edited Acceptance Criteria, so the existing evidence no longer
covers the current spec:

  qa-report.md      PASS (2026-07-14)  → stale
  > Reviewed:       APPROVE (2026-07-15) → stale

I'll mark both stale (nothing is deleted). Rerun the qa skill and
/code-review to replace them.

(mark stale / keep as-is — say why / adjust: only mark QA stale)
```

If the user keeps evidence as-is, record their reason in the Changelog row from Step 4 (append `; evidence kept: <reason>`). An override should be as visible as the change itself.

On confirmation, write the markers:

- **`qa-report.md`** — insert a `> Stale:` line directly after `> Verdict:`, inside the metadata block. Change nothing else; the report's findings stay exactly as they were.

  ```markdown
  > Verdict: PASS
  > Stale: spec changed 2026-08-02 (Acceptance Criteria) — rerun the qa skill
  ```

- **`tasks.md`** — append a stale marker to the existing `> Reviewed:` / `> SecurityReviewed:` line. Keep it on one line so the metadata block stays within the file's **first 15 lines**.

  ```markdown
  > Reviewed: 2026-07-15 APPROVE (stale — spec changed 2026-08-02)
  > SecurityReviewed: 2026-07-15 APPROVE (stale — spec changed 2026-08-02)
  ```

If there's no `qa-report.md` and no `> Reviewed:` line, there's no evidence to invalidate — skip silently.

**How the markers clear:** rerunning the qa skill overwrites `qa-report.md` entirely (marker included), and `/code-review` replaces the `> Reviewed:` line rather than appending. Neither needs a manual cleanup, and neither should be hand-edited to clear a marker — that's forging evidence.

**How readers treat them:** a `> Stale:` line in `qa-report.md` means *no valid QA*; `(stale` in a `> Reviewed:` line means *no valid review*. In `production` mode, `/verify` FAILs and the pr preflight refuses, exactly as if the evidence were missing. In `setup` mode both are reported as notes.

### Step 7: Report

Output a concise summary:

```
✓ Spec updated: softwareos/products/<product>/epics/<epic>/specs/<spec>/spec.md

  Sections updated: <list>
  Covers: +<added>, -<removed>   # only when > Covers: changed
  Changelog: YYYY-MM-DD · <author> · change · <what — why>
  Status: <unchanged | done → in-progress>
  Tasks: <N> added (T<a>–T<b>), <M> cancelled, <K> reopened
  Evidence: qa-report.md marked stale · > Reviewed: marked stale
  Next: rerun the qa skill and /code-review to restore verification
        (run /refresh-indexes to mirror the new > Covers: into specs.index.yml)
```

Omit the Covers line if `> Covers:` was unchanged. Omit the Tasks line if there was no tasks.md or no task changes. Omit the Evidence and Next lines if nothing was marked stale (the `/refresh-indexes` hint stays on its own line whenever Covers changed). In `production` mode, state plainly that `/verify` and the pr preflight will now refuse this spec until the evidence is regenerated — that's the intended consequence, not a surprise to discover at PR time.

## Tips

- **Small changes are still changes** — even a one-line AC tweak gets a Changelog row; that's the audit trail working.
- **The "why" matters most** — six months later, the one-line reason is what saves the next reader.
- **Cancelled ≠ deleted** — `[-]` tasks keep the history readable and the done ratio honest (cancelled tasks are excluded from it).
- **Stale ≠ deleted either** — a stale `qa-report.md` still records what was verified on the day it ran; the marker only says it no longer covers the current spec.
- **A one-line AC tweak can invalidate a whole QA run** — that's not overreach. If the criterion changed, the evidence was gathered against a different promise.
- **When in doubt, new spec** — if you're rewriting more than you're amending, /shape-spec keeps specs reviewable.
