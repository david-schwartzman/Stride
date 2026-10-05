---
description: Triage a reported problem (bug or change), fix defects with a regression test, and feed the fix back into the spec or a standard
argument-hint: "[bug description, or a Jira/Monday ticket URL or ID]"
---

# Hotfix

The single entry point for "something's wrong." You paste a description (with screenshots) or a ticket reference; this command **triages** it, and:

- if it's a **defect** → reproduces it, fixes it with a **regression test**, and records the correction in the **owning spec's Changelog** — and, when the real cause is a missing/weak rule, in a **standard**;
- if it's really a **change request** → hands off to `/spec-changes`;
- if the behavior was **never specified** → routes to clarifying/creating a spec.

**There is no bugs folder and no bug doc.** Your external tracker (Jira/Monday) is the ticket system; the spec Changelog (with the ticket linked in its `Ref`) is the in-repo record of truth. A bug or change request means the spec — or a standard — needs to become truer; this command makes that happen.

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if `<root>/softwareos/` exists that's the root, else walk up from cwd.
2. If not found: tell the user the repo isn't onboarded (run `/join-project` or the installer), then offer to just fix the problem plainly with no ceremony. If they accept, skip this process.
3. Read `softwareos/config.yml` — `default_branch` and the optional `customer_root`.
4. Resolve `mode:` per `/go-production` → [Reading the mode](./go-production.md#reading-the-mode). Mode affects Step 5 (regression test) and Step 7 (PR).
5. Enumerate specs from the filesystem: nested `softwareos/products/*/epics/*/specs/*/spec.md` (from `/join-project`) and, for pre-Phase-2 specs, flat `softwareos/epics/*/specs/*/spec.md`.

## Important Guidelines

- **Use AskUserQuestion** for any question; one at a time.
- **The spec is the single source of truth** — amend the owning spec, never create a bug doc.
- **Show before writing** — display the spec diff (and any standard change) and confirm.
- Never invent a root cause — investigate, or mark it explicitly unknown and keep going.

## Process

### Step 1: Intake

Accept whatever the user has:

- **Free text + screenshots** — a symptom, where it appears, repro steps.
- **A ticket reference** — a Jira key (`PROJ-123`), a Jira URL, or a Monday.com item URL/ID passed as the argument.

If a ticket reference is given, pull its contents:
- If a **connector/MCP for that tracker is available** (e.g. a Monday.com or Jira MCP tool — discover via ToolSearch), fetch the ticket's title, description, repro steps, and attachments. Authenticate if the tool requires it.
- If **no connector is available**, ask the user to paste the ticket's title, description, and any screenshots.
- Either way, **capture the ticket ID and URL** — it becomes the Changelog `Ref` (and the PR link) so the fix traces back to the ticket without any local doc.

Summarize your understanding of the problem back to the user in one or two lines and derive a kebab-case `<slug>` (max 40 chars) for the branch.

### Step 2: Triage — defect, change, or spec gap

Read the relevant spec(s) and standards, then classify. Use AskUserQuestion to confirm the classification:

```
This looks like a <defect | change request | spec gap>:
<one-line reasoning, referencing the spec/standard>

1. Defect — behavior violates the spec/standard → fix it here
2. Change request — new/changed desired behavior → I'll hand off to /spec-changes
3. Spec gap — never specified → let's define the intended behavior first
```

- **Change request** → tell the user to run `/spec-changes` (or offer to), and **stop** this command. A change is the spec evolving, not a bug.
- **Spec gap** → confirm the intended behavior with the user; that's a spec clarification (route to `/spec-changes`, or create a spec if the area has none) — optionally followed by a code fix in Step 5.
- **Defect** → continue.

### Step 3: Locate the owning spec

Grep spec titles + `## Overview` across the specs folders (Locating SoftwareOS, step 5) for keywords from the intake; use the ticket's area to narrow. Confirm the owning spec with AskUserQuestion (top 2–4 candidates).

If **no spec owns it**, the area was never specified — by definition that's a spec gap. Offer to create/extend a spec for it (route to `/shape-spec` or draft a minimal spec here), rather than filing the fix nowhere. Do not create a catch-all bugs location.

### Step 4: Root cause + classification

Investigate the code; dispatch the `code-explorer` agent for a non-obvious cause (give it the symptom, repro, suspected area). State the root cause in one line with `file:line`, and classify it:

- **spec gap** — the spec didn't cover this case → the spec section will be corrected.
- **standard gap** — a missing/weak rule (e.g. no input-validation standard) → a standard will be updated/created.
- **implementation defect** — spec and standards were correct; the code was wrong → fix + regression test only.
- **environmental** — dependency/upstream/infra → fix + note; usually no spec/standard change.

Confirm the root cause with the user before fixing (don't proceed on a guess).

### Step 5: Fix with a regression test

Ask whether to write a regression test — **default yes** (a fix without a reproducing test tends to come back); skip only for genuinely untestable/trivial cases:

```
Write a regression test that reproduces this before fixing? (yes / skip — <why>)
```

**In `production` mode a bare skip is not accepted.** The regression test is required; if the user still wants to skip it, they must give a reason, and that reason goes into the Changelog row in Step 6 (e.g. `hotfix | Fixed X — no regression test: <reason>`). A defect that reached a live system without a test proving it's gone is exactly what the mode exists to prevent, so make the exception visible in the spec rather than invisible in a conversation.

Then:
1. Create branch `hotfix/<epic-slug>/<slug>` from the default branch.
2. If testing: write the failing (red) test first — dispatch the `tdd-guide` agent or use the testing skill, seeded with the symptom + root cause.
3. Implement the **minimal** fix; the test goes green.

### Step 6: Feed the fix back (make the spec/standard truer)

This is the point of the command — no bug doc, the record lives in the spec (and maybe a standard):

1. **Always** append a Changelog row to the owning spec, `Type=hotfix`, `Ref` = the ticket link (or `—`):
   ```markdown
   | 2026-07-13 | <author> | hotfix | Corrected AC3: sessions expire after 30 min | [PROJ-123](https://…/PROJ-123) |
   ```
   Author from `git config user.name` (ask if unset).
2. If the root cause was a **spec gap**, also correct the affected spec section (e.g. tighten the AC or the Technical Approach). Show the before/after diff and confirm before writing.
3. If the root cause was a **standard gap**, update or create the relevant standard so it's enforced everywhere going forward — run `/discover-standards` for the area (or draft the standard and update `standards/index.yml`). Note it in the Changelog row.
4. If it was a **plain implementation defect**, the Changelog row + regression test is the whole record — no spec/standard content change beyond the row.
5. **Check the owning spec's `> Covers:` line against the file(s) the fix actually touched.** If Step 4's root cause is at a `file:line` that isn't matched by any value on the spec's Covers line (apply the same [match rules](./spec-of.md#the-match-rules) `/shape-spec` and `/spec-of` use), the map was wrong — the file was in this spec's scope but the claim never said so. Show the delta and offer to add the missing value(s) to `> Covers:` in the same edit, and note it in the Changelog row (e.g. `Covers: +src/lib/pricing.ts`). Skip when the fix touched no source files (docs-only), or when the touched file is already covered by an existing value. Never *remove* from Covers here — a hotfix isn't the place to shrink ownership; if the fix reveals a route/file belongs to a different spec, that's `/spec-changes` on both.
6. If the fix invalidated a completed task in the spec's `tasks.md`, flip that task `[x]` → `[~]` (never renumber) so it's re-verified.
7. If the root cause was a **spec gap** and you corrected a spec section in step 2 above, the existing evidence was gathered against the old text — mark it stale exactly as `/spec-changes` does: a `> Stale:` line after `> Verdict:` in `qa-report.md`, and a `(stale — spec changed <date>)` suffix on `> Reviewed:` / `> SecurityReviewed:` in `tasks.md`. A plain implementation defect doesn't need this: the spec didn't move, so the old QA still describes the right contract. **Covers-only edits** (no section text changed) do not mark evidence stale — the contract didn't shift, only the ownership claim caught up.

Show the full spec diff (and any standard change) and confirm before writing. If Covers changed, remind the user in the report to run `/refresh-indexes` to mirror it into `specs.index.yml`.

### Step 7: Open the PR

Suggest the `pr` skill — title `fix(<epic-slug>): <title>`; the body links the ticket, lists the regression test, and notes any spec/standard update. If the user chose not to implement now, report the branch name + the amended spec so anyone can pick it up.

In `production` mode, run `/code-review` before the pr skill rather than offering it — the pr preflight will require a recorded review anyway, and a hotfix diff on a live system is the last place to skip one.

## Edge Cases

- **No softwareos/ in the repo** — offer a plain fix without ceremony (Locating SoftwareOS, step 2).
- **Bug spans multiple specs** — add a `Type=hotfix` Changelog row (same ticket `Ref`) to EACH affected spec.
- **Recurrence of a past fix** — a new Changelog row on the same spec; if it keeps recurring, that's a signal the spec/standard is still wrong — strengthen it (or a standard) this time.
- **Ticket connector unavailable** — fall back to pasted ticket details; still record the ticket ID/URL as `Ref`.

## Tips

- **Tracker + spec, not a bug tracker in the repo** — Jira/Monday holds the ticket; the spec Changelog holds the truth; the `Ref` links them.
- **Every fix should make something truer** — the spec, or a standard. If neither needs to change, it was a plain defect and the regression test carries the lesson.
- **Change ≠ bug** — if the desired behavior is new, it's `/spec-changes`, not a hotfix.
