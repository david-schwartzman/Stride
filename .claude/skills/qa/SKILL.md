---
name: qa
description: Verifies a spec's implementation against its numbered acceptance criteria, runs repo checks, and writes qa-report.md into the spec folder. Use when tasks are done, before opening a PR, or when asked to QA, verify, or sign off a feature.
---

# QA

Verify that what was built matches what the spec promised. The spec's numbered Acceptance Criteria (AC1, AC2, ...) are the contract; this skill checks each one, runs the repo's verification commands, performs hygiene checks, and writes `qa-report.md` next to the spec.

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **One question at a time** — wait for each answer
- **Evidence over opinion** — every AC result must cite a test, a file:line, or an observed behavior
- **Never modify implementation code** — QA reports; fixing is routed to /hotfix or task reopen

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if it succeeds and `<root>/softwareos/` exists, that's the SoftwareOS root. If not a git repo, walk up from cwd looking for `softwareos/`.
2. If not found: tell the user this repo isn't onboarded — run `/plan-customer` (new customer) or the installer (`project-install.sh`) first. Stop.
3. Read `softwareos/config.yml`. If `customer_root` is set, read customer/ecosystem docs from that path instead of locally (if the path doesn't exist on disk, say so and continue with local stubs).
4. Resolve `mode:` per `/go-production` → [Reading the mode](../../commands/softwareos/go-production.md#reading-the-mode). It closes the checks-only path in Step 1 and tightens the verdict rules in Step 5.
5. Enumerate from the filesystem, never from caches: products = dirs under `softwareos/products/`; epics = dirs under `products/<product>/epics/`; specs = dirs under `products/<product>/epics/<epic>/specs/` (also read legacy flat `softwareos/epics/<epic>/specs/`).

## Inputs (auto-detected)

- **Spec folder** — from the current branch: first try an exact match — grep `^> Branch: ` across `softwareos/products/*/epics/*/specs/*/tasks.md` (and legacy `softwareos/epics/*/specs/*/tasks.md`) for the current branch name. If none, fall back to the convention: `feat/<epic-slug>/<spec-slug>` (strip any `--t<id>` suffix), suffix-match `<spec-slug>` against `products/<product>/epics/<epic-slug>/specs/YYYY-MM-DD-<spec-slug>/`. If neither resolves, ask: product+epic first, then spec (one question each).
- **spec.md** — the `## Acceptance Criteria` numbered list (the contract) and `## Changelog`
- **tasks.md** — task states and `> Branch:` / `> PR:` metadata (may be absent for PM-only specs)

## Process

### Step 1: Resolve the Spec

Auto-detect from the branch as above. Confirm before proceeding:

```
QA target: <epic-slug> / <spec-folder>
Branch: <branch> · Mode: <setup|production> · Tasks: <x/y done> · ACs: <n>

Correct? (yes / pick a different spec)
```

If spec.md has no Acceptance Criteria (PM section still pending):

- **`setup` mode** — use AskUserQuestion: run checks-only QA (verdict capped at PASS WITH NOTES, noting missing ACs) or stop and rerun `/shape-spec` as PM first.
- **`production` mode** — the checks-only path is unavailable. Stop and tell the user to rerun `/shape-spec` as PM: with no criteria there is no contract to verify, and a green build is not a passing spec. Don't offer a partial run.

### Step 2: Verify Each Acceptance Criterion

For each AC, in order, verify by the strongest available method:

1. **Tests** — find tests covering the AC (mapping comments like `// covers AC2`, or by path/name); run them scoped, record pass/fail.
2. **Inspection** — read the implementing code; confirm the behavior is actually there, cite file:line.
3. **Runtime** — if a dev server or CLI run is available, exercise the behavior and record what happened.

Record per AC: `pass` / `fail` / `not verifiable` + one-line evidence. Never mark an AC pass without evidence.

### Step 3: Run Repo Checks

Auto-detect commands (package.json scripts, Makefile, pyproject, etc.) and run whatever exists: **build → lint → typecheck → tests** (full suite). Record each command and its result. Failures get file:line.

### Step 4: Hygiene Checks

- All non-cancelled tasks in tasks.md are `[x]` (list any `[ ]`/`[~]` stragglers)
- Changelog consistent: the spec's `hotfix` Changelog rows are present and each fix's regression test passes; spec `> Status:` matches reality
- Branch state: `> PR:` recorded in tasks.md, or PR open (`gh pr list --head <branch>` if gh available), or branch merged into the default branch from config.yml

### Step 5: Determine Verdict and Write the Report

- **PASS** — all ACs pass, all checks green, hygiene clean
- **PASS WITH NOTES** — all ACs pass; minor non-blocking issues (hygiene gaps, lint noise, unverifiable AC with rationale)
- **FAIL** — any AC fails, or build/tests broken

**In `production` mode, PASS WITH NOTES stops absorbing verification gaps.** These become FAIL:

- an AC marked `not verifiable` — in production, "we couldn't check it" is not a pass; make it verifiable (add a test or a runtime check) or fail
- a hygiene gap from Step 4 — open tasks, an inconsistent Changelog, a hotfix whose regression test doesn't pass
- no test evidence for any AC — every AC needs a test, an inspection with `file:line`, or an observed runtime behavior, and in production at least one AC must be covered by an actual test

Lint noise on untouched files stays a note in both modes. When the mode is what produced a FAIL, say which rule fired — the verdict must be explainable from the report alone.

Show a one-screen summary, confirm, then write `qa-report.md` into the spec folder (template below). Overwrite any previous report — the latest run is the report of record. Overwriting also clears any `> Stale:` marker a previous `/spec-changes` left behind; that's the intended way to clear it. Never hand-edit the marker out of an old report — the point of rerunning is that the evidence gets regathered against the current spec.

### Step 6: Route Failures

On FAIL, use AskUserQuestion per issue:

- **Defect** (built behavior contradicts the spec) → offer `/hotfix` with the issue pre-described
- **Incomplete** (work simply not done) → offer to reopen the relevant task: flip `[x]` to `[~]` in tasks.md with a note referencing this QA run

On PASS, suggest the pr skill if no PR exists yet.

## qa-report.md Content

```markdown
# QA Report — <Spec Title>

> Spec: spec.md
> Date: YYYY-MM-DD · QA by: <git user.name> · Mode: setup | production
> Verdict: PASS | PASS WITH NOTES | FAIL

## Acceptance Criteria

| AC | Criterion | Result | Evidence |
|---|---|---|---|
| AC1 | <summary> | pass | <test name / file:line / observed behavior> |
| AC2 | <summary> | fail | <what happened instead> |

## Checks Run

- build: `<command>` — pass/fail
- lint: `<command>` — pass/fail
- typecheck: `<command>` — pass/fail
- tests: `<command>` — pass/fail (N passed, M failed)

## Issues Found

| # | Severity | Issue | Route |
|---|---|---|---|
| 1 | high/med/low | <one line> | /hotfix or reopen T<n> |

(none) — if clean.

## Notes

<unverifiable ACs with rationale, hygiene gaps, anything the next reader should know>
```

`/spec-changes` may later insert a `> Stale:` line after `> Verdict:` when the spec changes underneath this report. Never write one yourself, and never remove one — rerunning QA overwrites the whole file, which is how the marker clears.

## Tips

- **Run QA on the spec branch** with the work checked out — QA against stale code is worthless.
- **`not verifiable` is honest** — better than a fake pass; explain why in Notes and cap the verdict at PASS WITH NOTES. In `production` mode it's a FAIL instead: make the AC verifiable rather than annotating around it.
- **Record the mode in the report** — a PASS WITH NOTES from a setup-mode run means something different from one produced under production rules; the next reader needs to know which applied.
- **Re-run after fixes** — qa-report.md reflects the latest run only; /project-status flags done specs missing a report.
- **PM-only specs** can still get a checks-only report; the missing ACs are themselves a finding.
