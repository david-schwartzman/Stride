---
name: audit-log
description: Reconstructs a spec's full chronological history — changelog entries, hotfixes, spec doc edits, and code commits — into one merged timeline, printed to chat. Use when asked what happened to a spec, who changed what and when, or before picking up old work.
---

# Audit Log

Answer "what happened to this spec?" with one chronological timeline merged from three sources: the spec's Changelog table (which includes `hotfix` rows), git history of the spec folder, and code commits on the spec (and hotfix) branch. **Read-only — output to chat only, no files written or modified.**

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **One question at a time** — wait for each answer
- **Read-only** — never edit the spec, tasks, or git state while auditing
- **Never invent history** — only events found in the docs or git land in the timeline

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if it succeeds and `<root>/softwareos/` exists, that's the SoftwareOS root. If not a git repo, walk up from cwd looking for `softwareos/`.
2. If not found: tell the user this repo isn't onboarded — run `/plan-customer` (new customer) or the installer (`project-install.sh`) first. Stop.
3. Read `softwareos/config.yml`. If `customer_root` is set, read customer/ecosystem docs from that path instead of locally (if the path doesn't exist on disk, say so and continue with local stubs).
4. Enumerate from the filesystem, never from caches: products = dirs under `softwareos/products/`; epics = dirs under `products/<product>/epics/`; specs = dirs under `products/<product>/epics/<epic>/specs/` (also read legacy flat `softwareos/epics/<epic>/specs/`).

## Inputs

- **Spec locator** — if invoked with `<epic>/<spec>` or keywords, validate against the filesystem. If no argument given, first try resolving from the current branch via the branch convention: exact match — grep `^> Branch: ` across `softwareos/products/*/epics/*/specs/*/tasks.md` (and legacy `softwareos/epics/*/specs/*/tasks.md`) for the current branch name — then suffix-match `<spec-slug>` from `feat/<epic-slug>/<spec-slug>` against spec folders. Only if that fails, ask interactively: product+epic first (list `products/*/epics/*`), then spec (list that epic's `specs/*`) — one question each.
- **spec.md** — `## Changelog` rows (incl. `hotfix` rows with ticket links), `> Branch:` metadata
- **Git** — repo history; default branch from `softwareos/config.yml` (fallback `main`)

## Process

### Step 1: Resolve the Spec

Locate per Inputs above. Confirm:

```
Audit target: <epic-slug> / <spec-folder>

Correct? (yes / pick a different spec)
```

### Step 2: Collect Events

Gather from each source; every event becomes `(date, actor, kind, summary, ref)`:

1. **Changelog rows** (spec.md `## Changelog`) — kind `spec-change` (Types `created`/`change`) or `hotfix` (Type `hotfix`); ref = the row's Ref (an external ticket link for hotfixes).
2. **Spec doc edits** — `git log --follow --date=short --format='%ad %an %s' -- <spec folder>`; kind `doc-edit`. Drop commits that merely accompany a Changelog row already listed (same date + matching summary) to avoid double entries.
3. **Code commits** — resolve the branch from `> Branch:` metadata (fallback: suffix-match `feat/*/<spec-slug>` in local + remote refs); `git log <default_branch>..<branch> --date=short --format='%ad %an %s'`; kind `commit`. If the branch is gone or already merged, fallback: `git log --grep "<spec-slug>" --date=short --format='%ad %an %s'` on the default branch. Also include hotfix-branch commits (`hotfix/<epic>/<slug>`).

### Step 3: Merge and Render

Sort all events ascending by date (ties: spec-change → hotfix → doc-edit → commit). For noisy code history (>15 commits), collapse runs by the same author on the same day into one row (`N commits — <first subject> …`). Print to chat:

```
# Audit Log — <Spec Title>

<epic-slug> / <spec-folder> · Branch: <branch> · Status: <status>

| Date | Actor | Kind | Summary | Ref |
|---|---|---|---|---|
| YYYY-MM-DD | <name> | spec-change | Initial shaping | — |
| YYYY-MM-DD | <name> | commit | <subject> | <short-sha> |
| YYYY-MM-DD | <name> | hotfix | <what was corrected> | [PROJ-123](url) |
| YYYY-MM-DD | <name> | doc-edit | <subject> | <short-sha> |

Sources: changelog (N) · doc edits (N) · code commits (N)

**Current truth:** <spec folder>/spec.md — the spec is the single source of truth;
this timeline is how it got there.
```

End by noting anything suspicious found along the way (e.g. spec edits with no Changelog row, hotfix commits with no Changelog row) as one-line observations — fixing them is the user's call.

## Tips

- **No git repo / shallow clone** — degrade to doc-only timeline (changelog) and say so.
- **Empty branch history is signal** — a spec marked in-progress with zero commits is worth surfacing.
- **Stale refs** — offer `git fetch --prune` once if remote branches look outdated; never fetch without consent.
- **Pair with /spec-changes** — audit-log shows the trail; /spec-changes is how new entries get added properly.
