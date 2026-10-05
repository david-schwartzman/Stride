---
description: Run build → lint → typecheck → tests with auto-detected commands, plus spec/task status for the current branch — concise pass/fail report
---

# Verify

Run the repo's full verification pipeline (build → lint → typecheck → tests) using auto-detected commands. If the current branch maps to a spec, also check open acceptance criteria and tasks. Output a concise pass/fail report — verify reports, it does not fix.

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if it succeeds and `<root>/softwareos/` exists, that's the SoftwareOS root. If not a git repo, walk up from cwd looking for `softwareos/`.
2. If not found: verify still works — skip the spec-aware step (Step 3), run repo checks only, and note "no SoftwareOS docs in this repo" in the report.
3. Read `softwareos/config.yml`. If `customer_root` is set, read customer/ecosystem docs from that path instead of locally (if the path doesn't exist on disk, say so and continue with local stubs).
4. Resolve `mode:` per `/go-production` → [Reading the mode](./go-production.md#reading-the-mode). It changes the verdict rules in Step 4, the treatment of a skipped test stage in Step 1, and the handling of unmapped branches in Step 3. Surface any warning from the resolution (invalid value) in the report header.
5. Enumerate from the filesystem, never from caches: products = dirs under `softwareos/products/`; epics = dirs under `products/<product>/epics/`; specs = dirs under `products/<product>/epics/<epic>/specs/` (also read legacy flat `softwareos/epics/<epic>/specs/`).

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **One question at a time** — wait for each answer
- **Report, don't fix** — never edit code or configs during verify; route failures to the right tool (see Step 4)
- **Never skip or weaken checks** — no `--no-verify`, no disabling failing rules, no commenting out tests
- **file:line for every failure** — a failure without a location is not actionable

## Process

### Step 1: Detect Verification Commands

Prefer repo-defined commands over raw tool invocations. Check in order:

1. `softwareos/standards/testing/*` and `standards/global/*` — if a standard names verification commands, use those.
2. Project config files:

| Found | Build | Lint | Typecheck | Tests |
|---|---|---|---|---|
| `package.json` | `scripts.build` | `scripts.lint` | `scripts.typecheck` else `npx tsc --noEmit` (if tsconfig) | `scripts.test` |
| `Makefile` | `make build` | `make lint` | — | `make test` (use targets that exist) |
| `pyproject.toml` | — | `ruff check .` (if configured) | `mypy` (if configured) | `pytest` |
| `Cargo.toml` | `cargo build` | `cargo clippy -- -D warnings` | — | `cargo test` |
| `go.mod` | `go build ./...` | `go vet ./...` | — | `go test ./...` |

Skip stages with no detected command (mark "skipped" in the report, don't invent one).

**In `production` mode, a skipped *test* stage is a failure, not a skip.** A project that demands unit tests can't have no way to run them; report it as `tests FAIL — no test command detected` with the file you looked in (e.g. `package.json` has no `scripts.test`). Build/lint/typecheck stay "skipped" in both modes — not every stack has them.

For monorepos or ambiguous setups (multiple package managers, workspaces), use AskUserQuestion:

```
I detected these verification commands:

- build:     npm run build
- lint:      npm run lint
- typecheck: npx tsc --noEmit
- tests:     npm test

Run these? (confirm / adjust)
```

In unambiguous repos, just state the detected commands and run.

### Step 2: Run the Pipeline

Run in order: **build → lint → typecheck → tests**. Record pass/fail per stage.

- If **build** fails, stop (later stages are noise) — report the build errors and skip the rest as "blocked".
- Otherwise run every stage even after a failure — one full report beats four partial runs.
- For each failure, capture `file:line` and a one-line message. Cap at ~10 failures per stage ("…and N more").

### Step 3: Spec-Aware Checks

Skip silently if no `softwareos/` (per Locating SoftwareOS) — note it in the report instead.

1. Map the current branch to a spec: exact `> Branch:` metadata match across `products/*/epics/*/specs/*/tasks.md` (and legacy `epics/*/specs/*/tasks.md`) first; fallback suffix-match `<spec-slug>` against `feat/*/<spec-slug>` (including `--t<id>` parallel branches). `hotfix/*/*` branches map to their owning spec (by keyword/spec search or the spec's hotfix Changelog rows).
2. If mapped, read the spec's `spec.md` and `tasks.md`:
   - **Tasks** — done / total (cancelled excluded), in-progress count, open task IDs; call out open verification tasks (testing skill, qa skill) explicitly.
   - **ACs** — count numbered acceptance criteria; note any section still carrying a pending marker.
   - **QA** — does `qa-report.md` exist? If yes, report its `> Verdict:`. If it carries a `> Stale:` line, report the verdict as stale with the reason (e.g. `PASS (stale — spec changed 2026-08-02)`); a stale report is not evidence in either mode, it's a note in `setup` and a FAIL in `production`.
   - **Review** — `> Reviewed:` / `> SecurityReviewed:` from `tasks.md`. A value containing `(stale` means the recorded review no longer covers the current spec — surface it the same way.
3. If no spec maps, report "no spec mapped to branch `<name>`" — not an error in `setup`. In **`production`**, an unmapped `feat/*` branch is a warning: `no spec mapped — production gates not applied to this branch`. The verification-scope FAIL rows in Step 4 are all spec-scoped, so an unmapped `feat/*` branch would otherwise slip through them; the warning makes that visible. `chore/*` and `hotfix/*` are legitimately off-spec — no warning for those.

### Step 4: Report

Output the report (template below). Verdict rules depend on the mode from Step 0.4.

**`setup` mode** — **PASS** = all run stages pass; **FAIL** = any stage fails. Open tasks/ACs never flip the verdict; they're status, not failures.

**`production` mode** — every `setup` rule, plus these also FAIL:

| Condition | Why |
|---|---|
| An open (`[ ]`) or in-progress (`[~]`) task in the spec's **Verification** group | The mode requires tests + security review + QA; unfinished means unverified |
| A cancelled (`[-]`) task in the spec's **Verification** group | Cancelling a verification task is not completing it. In `setup` `[-]` is a legitimate "we decided not to"; in `production` those three tasks *are* the mode, so treat `[-]` exactly as `[ ]`. Legitimate exceptions (a spec with no testable surface) go through the `/go-production` waiver, not a state change in `tasks.md` |
| `qa-report.md` missing while `spec.md` `> Status:` is `done` | A done spec with no QA record isn't done |
| `qa-report.md` present with `> Verdict: FAIL` | QA said no |
| `qa-report.md` carries a `> Stale:` line | `/spec-changes` invalidated it — the report verified a spec that has since changed. Treat exactly as missing |
| Test stage skipped (no command detected) | Per Step 1 |
| Acceptance Criteria empty or still carrying a pending marker | Production QA can't verify against nothing |

Open *implementation* tasks (outside the Verification group) still never flip the verdict in either mode — work in progress is not a failure. Whenever the mode is what caused a FAIL, say so explicitly in the report line so the reason is legible, e.g. `FAIL (production mode) — verification tasks open: T9, T10`.

Route failures, don't fix them here:

- Build failures → dispatch the `build-error-resolver` agent (Agent tool) with the failing command and errors — only if the user asks.
- Failing or missing tests → testing skill.
- Before opening a PR → `/code-review`, then the pr skill.
- AC verification → qa skill.

## Output

```
VERIFY — <repo> @ <branch> · mode: production

Checks
  build      PASS                 (npm run build)
  lint       FAIL — 3 errors      (npm run lint)
             src/cart.ts:42   no-unused-vars 'tax'
             src/api/pay.ts:7 prefer-const
  typecheck  PASS                 (npx tsc --noEmit)
  tests      FAIL — 2 failing     (npm test)
             src/cart.test.ts:88  expected 3, got 2

Spec: <epic-slug>/<YYYY-MM-DD-spec-slug>
  Tasks: 6/9 done · 1 in progress · open: T7, T8 · verification open: T9 (qa skill)
  ACs: 5 — qa-report.md missing (ACs unverified)
  Review: APPROVE (stale — spec changed 2026-08-02) → rerun /code-review

Verdict: FAIL — fix lint + tests before PR
Next: testing skill for the failing tests · /code-review when green
```

Omit the `Spec:` block when unmapped (one line: `Spec: none mapped to this branch`). Always show the mode in the header — `· mode: setup` or `· mode: production` — so a reader can tell which rulebook produced the verdict.

## Tips

- Run `/verify` before the pr skill — the pr preflight runs the same pipeline and will refuse a dirty state anyway.
- In `setup`, a PASS with open verification tasks means the code is green but the spec isn't done — say so plainly. In `production` that same state is a FAIL.
- A production-mode FAIL caused only by open verification tasks isn't a code problem — route to the testing/qa skills, not to `build-error-resolver`.
- Long test suites: it's fine to ask whether to scope tests to changed paths; default to the full suite.
- Repeated runs in one session: skip re-detection, reuse the confirmed commands.
