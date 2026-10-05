---
description: Review the current branch diff against the default branch — standards-aware, spec-aware findings by severity with file:line; never auto-fixes
---

# Code Review

Review the current branch's diff against the default branch by dispatching the `code-reviewer` agent, armed with the relevant standards from `softwareos/standards/index.yml` and the owning spec's acceptance criteria. Findings come back by severity with file:line. Nothing is changed without explicit confirmation.

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if it succeeds and `<root>/softwareos/` exists, that's the SoftwareOS root. If not a git repo, walk up from cwd looking for `softwareos/`.
2. If not found: review still works — proceed without standards or spec context and note "no SoftwareOS docs in this repo; generic review" in the report.
3. Read `softwareos/config.yml`. If `customer_root` is set, read customer/ecosystem docs from that path instead of locally (if the path doesn't exist on disk, say so and continue with local stubs).
4. Resolve `mode:` per `/go-production` → [Reading the mode](./go-production.md#reading-the-mode). In `production` the `security-reviewer` agent is always dispatched (Step 3) and an unfixed HIGH/CRITICAL is a hard block (Step 5).
5. Enumerate from the filesystem, never from caches: products = dirs under `softwareos/products/`; epics = dirs under `products/<product>/epics/`; specs = dirs under `products/<product>/epics/<epic>/specs/` (also read legacy flat `softwareos/epics/<epic>/specs/`).

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **One question at a time** — wait for each answer
- **Never auto-fix** — present findings first; edit code only after the user confirms which fixes to apply
- **Full files, not hunks** — the reviewer reads each changed file in full; diff context alone misses bugs
- **Standards are the rubric** — project standards override generic style preferences; cite the standard file when flagging a violation

## Process

### Step 1: Establish the Diff

1. Read `default_branch` from `softwareos/config.yml` (fallback `main`).
2. Diff from the merge base: `git diff <default_branch>...HEAD --name-only`.
3. If on the default branch, or the branch has no commits beyond it, fall back to uncommitted work: `git diff HEAD --name-only` (plus untracked files via `git status --porcelain`).
4. If still empty, stop: "Nothing to review."
5. Categorize changed files: source / tests / config / docs. If >30 files, warn about scope and propose reviewing source first, then tests, then config/docs.

### Step 2: Gather Spec and Standards Context

**Spec** — map the branch to a spec: exact `> Branch:` metadata match across `products/*/epics/*/specs/*/tasks.md` (and legacy `epics/*/specs/*/tasks.md`) first; fallback suffix-match against `feat/*/<spec-slug>`; `hotfix/*/*` maps to its owning spec (by keyword/spec search). If mapped, read `spec.md` (Acceptance Criteria, Technical Approach, Out of Scope) and `tasks.md`. If unmapped, proceed without — note it.

If the existing `> Reviewed:` line is marked `(stale — spec changed …)`, the spec was amended after the last review. Read the spec's Changelog rows since that date so the review targets what actually changed, and say in the report that this run replaces a stale record.

**Standards** — read `softwareos/standards/index.yml` and select entries relevant to the changed files (match areas: api files → api/*, components → frontend/*, migrations → database/*, etc.). If the spec folder has a `standards.md`, start from that — it's the set already chosen at shaping time. Read the selected standards files in full. Confirm the selection:

```
Reviewing 12 files against these standards:

1. api/error-handling
2. api/response-format
3. database/migrations

(confirm / adjust: remove 3, add frontend/forms / skip standards)
```

### Step 3: Dispatch the Reviewer

Dispatch the `code-reviewer` agent (Agent tool) with: the diff range (`<default_branch>...HEAD` or "uncommitted"), the changed file list, the full content of the selected standards, the spec's acceptance criteria + Technical Approach (when mapped), and **the project mode from Step 0.4**. Instruct it to read each changed file in full and return findings per the checklist and severity scale below.

Pass the mode explicitly — the agent reads `config.yml` as a fallback, but the hand-off is what makes it reliable, the same way `/shape-spec` passes it to `planner`. In `production` the mode re-weights test-coverage and unchanged-code findings and tells the reviewer its verdict gates the PR; it does **not** loosen the agent's confidence filters, so a production review should not come back longer merely because of the mode.

Review checklist:

| Category | What to check |
|---|---|
| **Correctness** | Logic errors, off-by-ones, null handling, edge cases, race conditions |
| **Standards compliance** | Violations of the injected standards — cite the standard file |
| **Spec alignment** | Diff contradicts the spec, implements Out-of-Scope items, or leaves an AC visibly unmet |
| **Security** | Injection, auth gaps, secret exposure, path traversal, XSS, unvalidated input |
| **Type safety** | Unsafe casts, `any` leakage, type mismatches |
| **Performance** | N+1 queries, unbounded loops, memory leaks, oversized payloads |
| **Completeness** | Missing tests for new behavior, missing error handling, incomplete migrations |
| **Maintainability** | Dead code, magic numbers, deep nesting, unclear naming |

Severity scale:

| Severity | Meaning | Action |
|---|---|---|
| **CRITICAL** | Security vulnerability or data-loss risk | Must fix before merge |
| **HIGH** | Bug or logic error likely to cause issues | Should fix before merge |
| **MEDIUM** | Quality issue, standards violation, missing best practice | Fix recommended |
| **LOW** | Style nit or minor suggestion | Optional |

**Security review dispatch:**

- **`setup` mode** — dispatch the `security-reviewer` agent (Agent tool) with the same diff when it touches auth, crypto, or input-handling paths, and merge its findings.
- **`production` mode** — always dispatch it, regardless of what the diff touches. The path-based heuristic misses too much (a config change that widens CORS, a new dependency, a logging line that leaks a token), and in a live system that miss is the expensive one. Both agents can run concurrently — issue the two Agent calls in a single message.

### Step 4: Report Findings

Output the report (template below) in chat — no artifact file; the qa skill owns `qa-report.md`. Every finding needs `file:line`, a one-line description, and a suggested fix. Zero findings is a valid result — say so and stop.

### Step 5: Offer Fixes

Never apply fixes unprompted. Use AskUserQuestion:

```
4 findings (1 HIGH, 2 MEDIUM, 1 LOW). Apply suggested fixes?

1. Apply all
2. Apply selected (tell me which)
3. None — I'll handle them
```

Apply only the confirmed fixes, minimal diffs, then suggest rerunning `/verify`.

- **`setup` mode** — if any CRITICAL or HIGH finding remains unfixed, say plainly that this branch should not go to PR yet. It's advice; the user decides.
- **`production` mode** — an unfixed CRITICAL or HIGH is a block, not advice. Record the verdict as-is (Step 6) and state that the pr preflight will refuse this branch until the findings are fixed and the review re-run. Don't offer a way around it.

### Step 6: Record the Review

A review that leaves no trace can't be verified later — `/go-production` and the pr preflight both need to know a review happened. When the branch mapped to a spec (Step 2), write the record into that spec's `tasks.md` metadata block:

```markdown
> Branch: feat/checkout-redesign/guest-checkout
> PR: https://github.com/acme/rental/pull/142
> Reviewed: 2026-07-30 APPROVE WITH COMMENTS
> SecurityReviewed: 2026-07-30 APPROVE
```

Rules:

- Place these directly after `> Branch:` / `> PR:`. They **must** land inside the file's first 15 lines — `/project-status`, the qa skill, and the pr skill all parse only that window.
- Format: `> Reviewed: YYYY-MM-DD <verdict>` using the Step 4 verdict values. Write `> SecurityReviewed:` only when the `security-reviewer` agent actually ran, with its own verdict.
- **Replace** an existing line rather than appending a second one — the latest review is the record, same convention as `qa-report.md`. This is also how a `(stale — spec changed …)` marker left by `/spec-changes` clears: write the fresh line over it. Never hand-edit the marker away without actually re-reviewing.
- Record the verdict that's true *after* any fixes applied in Step 5. If HIGH findings were fixed and the code is now clean, re-derive the verdict; don't record a stale REQUEST CHANGES.
- No spec mapped, or the review was scoped to uncommitted work? Skip this step and say so — there's nowhere to record it.

This is a metadata line, not a new artifact: `qa-report.md` remains the only file the spec folder gains from verification.

## Output

```
CODE REVIEW — <branch> vs <default_branch> · mode: production   (12 files: 8 source, 3 tests, 1 config)
Spec: <epic-slug>/<YYYY-MM-DD-spec-slug> · Standards: api/error-handling, api/response-format

Verdict: REQUEST CHANGES — 1 HIGH

HIGH
- src/api/pay.ts:88 — refund amount not validated against original charge; negative
  values pass through. Fix: clamp to [0, charge.amount] before calling provider.

MEDIUM
- src/api/pay.ts:31 — raw error body returned to client, violates api/error-handling.
  Fix: wrap in the standard error envelope.
- src/cart/totals.ts:12 — no test covers the rounding branch (AC3). Fix: add case to
  totals.test.ts.

LOW
- src/cart/totals.ts:40 — magic number 0.0825; name it TAX_RATE.

Spec alignment: AC1, AC2 covered · AC3 untested · nothing out of scope touched
Recorded: > Reviewed: 2026-07-30 REQUEST CHANGES → softwareos/…/guest-checkout/tasks.md
```

Verdict values: **APPROVE** (no findings or LOW only) · **APPROVE WITH COMMENTS** (MEDIUM only) · **REQUEST CHANGES** (any HIGH) · **BLOCK** (any CRITICAL).

## Tips

- Run after `/verify` passes — reviewing code that doesn't build wastes the reviewer's pass.
- The pr skill offers this same review pre-open; running it earlier means cheaper fixes.
- In `production` mode the pr preflight reads the `> Reviewed:` line this command writes — skipping Step 6 means the PR gets blocked for a review that actually happened.
- Diverged from the default branch? Suggest `git fetch origin && git rebase origin/<default_branch>` first so the diff is honest.
- Docs/config-only diffs get a lighter pass — correctness only, skip the standards ceremony.
