---
name: curate
description: Notice recurring patterns in how the team works and offer to codify them as a standard or a skill
argument-hint: "[optional area or path to focus on]"
---

# /curate

Sweep for **persisting patterns** in how this codebase is actually built, and offer to codify each one — as a **standard** (a rule) or a **skill** (a repeatable procedure). This is the proactive front-end to `/discover-standards` and `skill-creator`: it decides *what* is worth codifying and *when*, then routes to the right authoring tool.

Example it's built for: "When you add a component, it's done across Strapi + backend + frontend — want a `/create-component` skill for that?"

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if `<root>/softwareos/` exists that's the root, else walk up from cwd.
2. If not found, tell the user to run `/join-project` or the installer, and stop.
3. Read `softwareos/config.yml`.

## Process

### Step 1: Load context

- Read `softwareos/standards/index.yml` (what's already a standard) and list the installed skills under `.claude/skills/` (what's already a skill) — so nothing already codified is re-proposed.
- Read `softwareos/.curate.yml` if present — its `dismissed:` list (patterns the team chose not to codify) and `last_reviewed:` marker. Create the file lazily later if absent.

### Step 2: Dispatch the curator

Dispatch the `curator` agent (Agent tool), passing: the focus area/path if one was given as an argument, the already-codified standards + skills, and the `dismissed:` list. It returns ranked candidates, each classified `standard` or `skill` with evidence and a draft scope.

If it returns nothing, report "no new patterns worth codifying since the last sweep" and update `last_reviewed` (Step 4). Done.

### Step 3: Offer each candidate (one at a time)

For each candidate, show its evidence + draft scope and use AskUserQuestion:

```
Recurring pattern: <title>
Seen in: <evidence>
Proposed: a <standard|skill> — <draft scope>

1. Create it as a <skill|standard> (recommended for this one)
2. Create it as the other kind instead
3. Dismiss — don't suggest this again
4. Skip for now
```

On the user's choice:
- **Create a skill** → invoke the `skill-creator` skill (Skill tool) to author it from the draft scope (name from `suggested-name`); it scaffolds into `.claude/skills/`.
- **Create a standard** → run the `/discover-standards` flow for that area (it writes `softwareos/standards/<area>/<name>.md` and updates `index.yml`).
- **Dismiss** → append the pattern (its `suggested-name` + a one-line reason) to `dismissed:` in `softwareos/.curate.yml` so it's never re-proposed (team-shared).
- **Skip** → leave it; it can resurface next sweep.

### Step 4: Record the sweep

Write `softwareos/.curate.yml` with `last_reviewed:` set to the current `HEAD` sha and today's date, preserving the `dismissed:` list. This is what the tripwire hook reads to decide when to nudge again.

```yaml
# Tracks /curate sweeps. Committed so the team shares the dismissed list.
last_reviewed: { sha: <HEAD sha>, date: <YYYY-MM-DD> }
dismissed:
  - { name: <slug>, reason: <why>, date: <YYYY-MM-DD> }
```

### Step 5: Report

Summarize: candidates found, what was created (standards/skills, with paths), what was dismissed/skipped. If any standard was created, note that specs referencing that area should apply it going forward.

## Tips

- **Codify procedures as skills, rules as standards** — a thing you *do the same way each time* is a skill; a thing you *check code against* is a standard.
- **Evidence over vibes** — only patterns the `curator` backed with real recurrences (git/specs) are offered.
- **Dismiss is permanent-ish** — a dismissed pattern won't nag again; re-add it by editing `softwareos/.curate.yml` if you change your mind.
- **Pairs with the tripwire** — the SessionStart nudge tells you *when* enough has changed to be worth a sweep; `/curate` is the sweep.
