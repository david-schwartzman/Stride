---
description: Audit production readiness, then flip the project mode from setup to production — gap checklist with explicit waivers
argument-hint: "[--revert]"
---

# Go Production

Transition a project from `mode: setup` to `mode: production`. This is not a config edit
with extra steps — it audits every spec and the repo's verification surface first, shows
the gaps, and makes you either fix or **explicitly waive** each blocking one. The result
is written to `softwareos/production-readiness.md` so the decision has a record.

After the flip, `/shape-spec` stops offering "no automated tests", and `/verify`, the qa
skill, and the pr preflight fail on missing verification instead of noting it.

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if it succeeds and `<root>/softwareos/` exists, that's the SoftwareOS root. If not a git repo, walk up from cwd looking for `softwareos/`.
2. If not found: tell the user this repo isn't onboarded — run `/join-project` (existing codebase) or the installer (`project-install.sh`) first. Stop.
3. Read `softwareos/config.yml`. If `customer_root` is set, read customer/ecosystem docs from that path instead of locally (if the path doesn't exist on disk, say so and continue with local stubs).
4. Enumerate from the filesystem, never from caches: products = dirs under `softwareos/products/`; epics = dirs under `products/<product>/epics/`; specs = dirs under `products/<product>/epics/<epic>/specs/` (also read legacy flat `softwareos/epics/<epic>/specs/`).

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **One question at a time** — wait for each answer
- **Never waive silently** — every unfixed blocking gap needs a reason recorded in the report
- **Report before writing** — show the full checklist and get confirmation before touching `config.yml`
- **Read-only until the final step** — the audit changes nothing

## Arguments

- `--revert` — go back to `mode: setup` (see [Reverting](#reverting))

## Reading the mode

**This is the canonical mode-resolution rule for SoftwareOS.** Every command and skill that behaves differently by mode reads it the same way — if this rule ever changes, it changes here.

Read `mode:` from `softwareos/config.yml`, matched case-insensitively:

- **`setup`** — loose gates. Default for new installs and the compatibility floor for projects onboarded before modes existed.
- **`production`** — strict gates. Every command with mode-aware behavior tightens.
- **Absent key** — treat as `setup` silently. The floor keeps pre-modes projects behaving exactly as they did.
- **Any other value** (`prod`, `strict`, empty `mode:`, unknown enum) — also runs as `setup`, but **say so loudly**: name the bad value, state that production gates are OFF, and list the two valid values. Never fail open silently.
- **Non-canonical case** (`Production`, `SETUP`) — treat as that mode; if writing the file, normalize to lowercase.
- **No `softwareos/` at all** — assume `setup` silently.

Callers that receive a mode from a parent command (e.g. `planner` invoked by `/shape-spec`) trust the passed value over reading the file again.

## Process

### Step 1: Check the Current Mode

Apply [Reading the mode](#reading-the-mode) to determine the current state, then branch:

- Already `production` and no `--revert`: say so, offer to re-run the audit read-only (useful for finding drift), and stop without writing.
- `--revert` passed: jump to [Reverting](#reverting).
- `setup`, or the key is absent: continue. If it was absent, note that it will now be written explicitly.
- **Invalid value** (`prod`, `strict`, empty, unknown): this is a broken config, not a project in `setup`. Every command has been silently running as `setup` per the resolution rule, so production gates were off regardless of what the team believed. Continuing fixes it, since this command writes `mode:` anyway; offer to write `setup` instead if they only wanted the typo corrected without transitioning.

### Step 2: Audit Every Spec

Enumerate every spec folder and check each item. Cheap greps only — this is an audit, not a test run.

| Check | How | Severity |
|---|---|---|
| `tasks.md` exists | file present (absent = PM-only spec, still shaped) | advisory |
| Tasks complete | no `[ ]` / `[~]` lines; cancelled `[-]` excluded in general, **but a `[-]` inside the Verification group counts as open** (see next row) | blocking if spec status is `done` |
| Verification tasks not cancelled | in the Verification group (testing / security-review / QA tasks), `[-]` is treated exactly like `[ ]`. Cancelling a verification task is not completing it — in `setup` a cancelled task is a legitimate "we decided not to"; in `production` these three tasks *are* the mode. If a spec has no testable surface, use a waiver here, not a state change in `tasks.md` | **blocking** if spec status is `done` |
| Acceptance criteria present | `## Acceptance Criteria` has a numbered list, no `_Pending —` marker | **blocking** |
| `qa-report.md` exists and passed | file present, `> Verdict:` is `PASS` or `PASS WITH NOTES`, and **no `> Stale:` line** | **blocking** if spec status is `done` |
| Test evidence | tests exist mapping to this spec — grep the test tree for `covers AC` / `covers T` comments (the mapping convention the testing skill writes) | **blocking** if spec status is `done` |
| Code review recorded | `> Reviewed:` in `tasks.md` metadata, **not containing `(stale`** | **blocking** if spec status is `done`; n/a when the spec has no `tasks.md` (PM-only) |
| Security review recorded | `> SecurityReviewed:` in `tasks.md` metadata (same staleness rule) — required only when the spec touched sensitive paths (auth, payments, user input, file upload, crypto). **Note:** production `/code-review` dispatches `security-reviewer` unconditionally, so specs reviewed *under production* always have this line. The conditional exists mainly for specs that were reviewed under `setup` before the transition. | **blocking** when applicable |

Stale evidence is a distinct finding from missing evidence — report it as such (`qa-report.md stale since 2026-08-02 (spec changed)`), because the fix is different: someone verified this once and the spec moved, so rerunning is usually quick.

A spec whose `> Status:` is still `shaped` or `in-progress` is **not** a gap for tasks, QA, test evidence, or code review — unfinished work is expected and those checks wait for `done`. It **is** a gap for missing acceptance criteria regardless of status, because production-mode QA can't run without them and shaping is where ACs get written.

### Step 3: Audit the Repo's Verification Surface

| Check | How | Severity |
|---|---|---|
| Test command | detectable per the `/verify` detection table (`scripts.test`, `pytest`, `go test`, `cargo test`, `make test`) | **blocking** — production mode fails a skipped test stage |
| Lint command | same table | advisory |
| Typecheck command | same table (or `tsc --noEmit` with a tsconfig) | advisory |
| Tests actually run green | offer to run `/verify` now rather than assuming | **blocking** if it fails |
| CI configured | `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/` | advisory |
| Testing standard | `softwareos/standards/testing/*` exists | advisory — suggest `/discover-standards` |
| Secret scanning | `gitleaks` on PATH (the secret-scan hook falls back to regex without it) | advisory |
| Hooks installed | `.claude/hooks/softwareos/` present and registered in `.claude/settings.json` | advisory — no production gate depends on them, but the mode banner and secret scan do |
| Branch protection | the default branch requires status checks (`gh api repos/{owner}/{repo}/branches/<default>/protection` if `gh` is available) | advisory — **the only gate that holds against a merge clicked in the GitHub UI.** Recommend enabling it with the test workflow as a required check |

### Step 4: Present the Checklist

Show blocking gaps first, then advisory, each with the path that proves it. Then the count.

```
PRODUCTION READINESS — acme-corp/rental · 7 specs across 3 epics

BLOCKING (4)
- checkout-flow/2026-03-04-guest-checkout — no test evidence (no `covers AC` mapping found)
- checkout-flow/2026-03-04-guest-checkout — no `> Reviewed:` line in tasks.md
- payments/2026-04-01-refund-api — spec status done, qa-report.md missing
- repo — no test command detected (package.json has no `scripts.test`)

ADVISORY (2)
- repo — no softwareos/standards/testing/* (run /discover-standards)
- repo — gitleaks not installed; secret-scan falls back to regex

CLEAN (3 specs)
- search-flow/2026-02-11-filters · search-flow/2026-02-20-sort · payments/2026-05-02-webhooks
```

If there are **zero** blocking gaps, say so plainly and go to Step 6.

### Step 5: Resolve Each Blocking Gap

One `AskUserQuestion` per blocking gap — do not batch them into a single yes/no:

```
BLOCKING: checkout-flow/2026-03-04-guest-checkout has no test evidence.

1. Fix now — run the testing skill for this spec (I'll come back here after)
2. Waive — production mode goes on, this gap is recorded with your reason
3. Cancel the transition
```

- **Fix now** — route to the right tool (testing skill, qa skill, `/code-review`, `/shape-spec` as PM for missing ACs), then re-check that item.
- **Waive** — ask for a one-line reason and keep it. A waiver with no reason is not a waiver; re-ask.
- **Cancel** — stop, write nothing, and summarize what remains.

Advisory gaps are never gated. Mention them once and carry them into the report as-is.

### Step 6: Apply

1. Write `mode: production` into `softwareos/config.yml` — replace an existing `mode:` line in place; if the key is absent, append it with its explanatory comment. Touch nothing else in the file.
2. Write `softwareos/production-readiness.md` (template below). Regenerate on re-run, but **never drop the History section** — append to it.
3. Report: mode flipped, N gaps fixed, N waived, N advisory, and what changes for the team from here on:

```
mode: production

From now on:
- /shape-spec no longer offers "no automated tests"; every spec gets unit-test,
  security-review, and QA tasks
- /verify FAILs on open verification tasks, a missing qa-report.md, or a skipped
  test stage
- the qa skill can no longer PASS a spec with no acceptance criteria
- the pr preflight blocks without a passing qa-report.md and a recorded review

Git is not gated — commit and push as usual. For a gate that holds at merge,
add GitHub branch protection with required status checks.
```

## Reverting

`/go-production --revert` sets `mode: setup`. It is deliberate and recorded, not a quiet
back door.

1. Confirm with `AskUserQuestion`, and require a reason.
2. Write `mode: setup` to `config.yml`.
3. **Append** a dated entry to the History section of `production-readiness.md` — never
   overwrite the file on a revert, the previous readiness record is the point.
4. Report the flip and note that the gates are advisory again.

## production-readiness.md Content

```markdown
# Production Readiness — {Customer} / {Repo}

> Mode: production
> Transitioned: YYYY-MM-DD by <git user.name>

## Audit

| Scope | Check | Result |
|---|---|---|
| checkout-flow/2026-03-04-guest-checkout | test evidence | waived |
| checkout-flow/2026-03-04-guest-checkout | code review recorded | fixed |
| payments/2026-04-01-refund-api | qa-report.md | fixed |
| repo | test command | fixed — added `scripts.test` |

## Waivers

| Scope | Gap | Reason | Waived by | Date |
|---|---|---|---|---|
| checkout-flow/2026-03-04-guest-checkout | no test evidence | Legacy spec, shipped pre-SoftwareOS; covered by manual QA and scheduled for backfill in Q4 | Ido Yotvat | 2026-07-30 |

## Advisory (not blocking)

- no `softwareos/standards/testing/*` — run /discover-standards
- gitleaks not installed; secret-scan falls back to regex

## History

| Date | Author | Change | Reason |
|---|---|---|---|
| 2026-07-30 | Ido Yotvat | setup → production | Pilot complete, app is live |
```

## Edge Cases

- **Zero specs** — nothing to audit per-spec. Run the repo-level checks only and say plainly that the mode is being set on an empty hierarchy; that's valid for a repo onboarded before any spec work.
- **Legacy flat layout** (`softwareos/epics/*/specs/*`) — audit it the same way; don't require a migration first.
- **Multi-repo customer** (`customer_root` set) — the audit covers **this repo only**. Say so in the report header, and note that each repo has its own `mode`.
- **Already `production`, run again** — treat it as a drift audit: show the checklist read-only, write nothing.
- **A waived gap gets fixed later** — re-running `/go-production` in production mode re-audits; if the gap is gone, drop it from Waivers on regeneration (History still shows the transition).

## Tips
- Run `/project-status` first — its FLAGS section already surfaces DRIFT and STALE, which are usually the same gaps this command will block on.
- Waiving is legitimate. A pilot repo with three pre-SoftwareOS specs shouldn't be held hostage by backfill; record the reason and move on.
- If more than half the specs need waivers, the project probably isn't ready — say so rather than rubber-stamping a checklist full of exceptions.
