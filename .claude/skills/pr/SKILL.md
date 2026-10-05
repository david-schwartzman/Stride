---
name: pr
description: Opens a pull request for the current spec or hotfix branch — runs repo verification, composes title and body from the spec's tasks and acceptance criteria, creates the PR with gh, and records the URL back into tasks.md and the epic. Use when work on a branch is ready for review or the user asks to open or create a PR.
---

# PR

Open a pull request that carries its spec with it: linked spec, task checklist with live states, AC summary, and qa evidence — so reviewers review against the single source of truth.

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **One question at a time** — wait for each answer
- **NEVER use `--no-verify`** — failing hooks mean failing work; fix the cause, never bypass
- **Never `--force` push** — `--force-with-lease` only, only on your own feature branch after a rebase

## Process

### Step 1: Resolve the Spec from the Branch

`git branch --show-current`, then (stripping any `--t<id>` suffix):

- Exact: grep `^> Branch: ` in `softwareos/products/*/epics/*/specs/*/tasks.md` (and legacy `softwareos/epics/*/specs/*/tasks.md`) for the current branch.
- Fallback: suffix-match `<spec-slug>` from `feat/<epic-slug>/<spec-slug>` against spec folders.
- `hotfix/<epic-slug>/<slug>` → resolve the owning spec (by keyword/spec search or the spec's hotfix Changelog rows).

If the branch doesn't match the convention, AskUserQuestion:

```
This branch (<name>) doesn't match the branch convention.

1. Rename it to the canonical branch for a spec (I'll list specs)
2. Continue without a spec (plain PR — title/body from commits only)
3. Cancel
```

Option 1: list epics → specs, then `git branch -m feat/<epic-slug>/<spec-slug>`.

### Step 2: Preflight

Resolve `mode:` per `/go-production` → [Reading the mode](../../commands/softwareos/go-production.md#reading-the-mode) first. It adds rows to this table.

Both modes:

| Check | Action if failed |
|---|---|
| Not on the default branch (`softwareos/config.yml`, fallback `main`) | Stop — create a feature branch first |
| Clean tree (`git status --short`) | Stop — commit or stash first |
| Commits ahead of default branch | Stop — nothing to PR |
| No existing open PR for this branch (`gh pr list --head <branch>`) | Stop — show its URL |
| Repo verification passes — build, lint, typecheck, tests (auto-detect from package.json/Makefile/pyproject) | Report failures `file:line` and stop. Fix or get explicit user go-ahead to open as draft. Never `--no-verify`. |

`production` mode only:

| Check | Action if failed |
|---|---|
| `qa-report.md` exists in the spec folder with `> Verdict:` PASS or PASS WITH NOTES | Stop — run the qa skill first |
| That report carries **no** `> Stale:` line | Stop — `/spec-changes` invalidated it; rerun the qa skill against the current spec |
| `> Reviewed:` present in `tasks.md` metadata (written by `/code-review`) | Stop — run `/code-review` first |
| That line does **not** contain `(stale` | Stop — the spec changed after the review; rerun `/code-review` |
| That review's recorded verdict is not `REQUEST CHANGES` or `BLOCK` | Stop — the HIGH/CRITICAL findings must be fixed and the review re-run |
| `> SecurityReviewed:` present when the diff touches auth, crypto, payments, user input, or file upload | Stop — run `/code-review` (it dispatches `security-reviewer` unconditionally in production) |
| No open (`[ ]`/`[~]`) task in the spec's **Verification** group | Stop — tests/security review/QA are the gate, not paperwork |

A production-mode preflight stop is not a suggestion. Don't offer "open as draft anyway" as a way around these five — a draft PR is for incomplete *work*, not for skipping verification. If the user genuinely needs to ship without them, that's a `/go-production --revert` decision or a recorded waiver, and say so.

### Step 3: Compose Title

- Spec branch: `feat(<epic-slug>): <spec title from spec.md>`
- Hotfix branch: `fix(<epic-slug>): <fix title from the spec/ticket>`
- No spec: conventional-commit title from the dominant commit type.

### Step 4: Compose Body

If `.github/PULL_REQUEST_TEMPLATE.md` (or `.github/PULL_REQUEST_TEMPLATE/` dir) exists, fill its sections with the content below; otherwise use this template:

```markdown
## Spec

[<spec title>](softwareos/products/<product>/epics/<epic-slug>/specs/<spec-folder>/spec.md)

## Tasks

<checklist copied from tasks.md with current states; omit cancelled [-] tasks>

## Acceptance Criteria

<one line per AC from spec.md: "AC1: <criterion> — <covered by test / verified manually / pending>">

## QA

<link to qa-report.md + its Verdict, or "Not yet run — qa skill">

## Review

<`> Reviewed:` date + verdict from tasks.md; add the `> SecurityReviewed:` line when
present. Omit this section entirely in setup mode when no review was recorded.>

## Visuals

<embed/link files from the spec's visuals/ when the diff touches UI; omit section otherwise>
```

Hotfix PRs: link the owning spec; summarize the fix, the regression test, and any standard update (there is no bug doc).

### Step 5: Draft or Ready

If tasks.md has open `[ ]` or in-progress `[~]` tasks:

```
<N> tasks are still open on this spec. Open the PR as:

1. Draft (recommended — work in progress)
2. Ready for review
```

### Step 6: Pre-Open Review

**`setup` mode** — optional. AskUserQuestion:

```
Want a review before opening?

1. No — open the PR now
2. Yes — dispatch the code-reviewer agent on the branch diff
```

If the diff touches auth, crypto, or user-input handling, recommend also dispatching the `security-reviewer` agent (Agent tool).

**`production` mode** — not optional, but usually already satisfied: Step 2 required a non-stale `> Reviewed:` record, so a review has happened. Don't re-review a diff that hasn't changed since that record. Do re-review if commits landed after the recorded review date, or if the record was marked stale by `/spec-changes` — say why, and run `/code-review` rather than asking.

Either way, dispatch the `code-reviewer` agent (Agent tool) with: the diff vs the default branch, the spec path, and relevant standards from `softwareos/standards/index.yml`. Surface findings; let the user fix or proceed.

### Step 7: Push & Create

```bash
git push -u origin HEAD
gh pr create --title "<title>" --base <default_branch> --body "<body>"   # add --draft per Step 5
```

Push rejected because remote diverged → `git fetch origin && git rebase origin/<default_branch>`, then `git push --force-with-lease`. Rebase conflicts → stop and report.

**No `gh` or not authenticated**: push the branch, print the compare URL (`https://github.com/<org>/<repo>/compare/<default>...<branch>`) plus the prepared title and body for manual creation, and note that the record step below was skipped.

### Step 8: Record the URL

- `tasks.md`: add `> PR: <url>` directly after the `> Branch:` line (must stay within the first 15 lines, alongside any `> Reviewed:` / `> SecurityReviewed:` records).
- `epic.md` Specs table: append the PR URL into this spec's existing Branch cell, e.g. `feat/<epic>/<slug> · [#42](url)` — do NOT add a new column.
- Hotfix: record `> PR: <url>` on the owning spec's `tasks.md` (same as a spec PR).

Then report: PR number, URL, draft/ready, tasks done ratio, CI check status (`gh pr checks` if available).

## Tips

- **Run the qa skill first** when the spec is supposedly done — a PASS verdict in the body short-circuits review questions.
- **Incomplete tasks aren't a blocker** — draft PRs early are good; the checklist shows reviewers exactly what's left. Open *Verification* tasks in `production` mode are a blocker, though; that's the one exception.
- **Large diff (>20 files)?** Mention it and suggest splitting via `--t<id>` parallel branches if the work is separable.
- **The `> PR:` line makes /project-status work** — don't skip Step 8.
