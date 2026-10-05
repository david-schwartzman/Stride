---
name: testing
description: Generates and runs tests for the current spec — TDD failing-first generation mapped to acceptance criteria and task IDs, scoped test runs, and coverage reporting on changed files. Use when writing tests, starting TDD on a task, verifying a fix, or checking tests before opening a PR.
---

# Testing

Generate and/or run tests for the spec being worked on. Every generated test is mapped to the spec's acceptance criteria (ACs) and tasks so the qa skill and reviewers can trace coverage.

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **One question at a time** — wait for each answer
- **Match repo conventions** — generated tests must look like the tests already in the repo
- **No hard coverage gate** — report coverage on changed files; the user decides what's enough

## Inputs (auto-detected)

1. **SoftwareOS root**: `git rev-parse --show-toplevel`, then check `<root>/softwareos/` exists. If it doesn't, skip spec mapping — detect/generate/run from repo conventions alone.
2. **Current spec**, from the branch name (strip any `--t<id>` parallel-work suffix first):
   - Exact: grep `^> Branch: ` in `softwareos/products/*/epics/*/specs/*/tasks.md` (and legacy `softwareos/epics/*/specs/*/tasks.md`) for the current branch.
   - Fallback: suffix-match `<spec-slug>` from `feat/<epic-slug>/<spec-slug>` against spec folder names.
   - Hotfix branch `hotfix/<epic-slug>/<slug>` → map to its owning spec (by keyword/spec search or the spec's hotfix Changelog rows).
   - No match → AskUserQuestion: list epics → specs, plus "no spec — just work from the code".
3. **Spec context**: `spec.md` Acceptance Criteria (AC1, AC2, …), open tasks in `tasks.md`, and `softwareos/standards/testing/*` if present (read and follow).

## Process

### Step 1: Detect Runner & Conventions

- Find the runner: `package.json` scripts (`test`, `test:unit`, `test:e2e`), `pyproject.toml`/`pytest.ini`, `Makefile`, `go.mod`, etc.
- Read 2-3 existing test files near the code under test. Note file naming (`*.test.ts` vs `__tests__/` vs `tests/`), assertion style, mocking patterns, shared setup helpers.
- No tests in the repo yet → say so, propose a convention for the stack, confirm before generating.

### Step 2: Choose Mode

```
What do you want to do?

1. Generate — write tests for the open tasks/ACs (TDD, failing-first)
2. Run — run existing tests related to this spec
3. Both — generate, then run
```

### Step 3: Generate (modes 1 & 3)

For each open task or cluster of related ACs:

- One test file per task or AC cluster, named per repo convention, placed where the repo places tests.
- Add a mapping comment at the top of each file (and per-case where it helps), in the language's comment syntax:

  ```
  // covers AC2, AC3, T4
  ```

- **Failing-first**: when the implementation doesn't exist yet, the tests SHOULD fail. Never stub the implementation just to go green.
- Cover happy path, edge cases, error scenarios, boundary conditions. Skip exhaustive permutations.
- Present the planned files first (path + which ACs/tasks each covers); adjust on feedback, then write.

### Step 4: Run (modes 2 & 3)

- Scope the run to paths related to the spec: tests just generated plus tests touching changed modules. Not the whole suite unless asked.
- Report failures as `file:line — expected vs actual`, grouped by test file.
- For failing-first tests: confirm each fails **for the intended reason** (missing/buggy implementation), not broken setup, bad imports, or syntax errors. That confirmed failure is the RED signal — implementation can start; rerun after implementing until green.

### Step 5: Coverage on Changed Files

If the runner supports coverage, run it scoped to changed files (`git diff --name-only <default_branch>...HEAD`) and report per-file percentages. No threshold is enforced — flag files under ~50% as worth a look.

### Step 6: Offer Task Tick-Off

If `tasks.md` has verification tasks this run satisfies, offer to tick them:

```
These verification tasks look satisfied:

- [ ] T6 Write unit tests for the rate limiter
- [ ] T7 Run test suite for the payments module

Mark them [x] in tasks.md? (yes / pick which / no)
```

Only tick tasks backed by evidence from this session (tests written AND passing — or failing-first by design). Never renumber or remove task IDs.

**In `production` mode** (`mode:` in `softwareos/config.yml`; absent = `setup`) this rule carries weight beyond bookkeeping: an open Verification task makes `/verify` FAIL, so ticking one is what declares the spec verified. Never tick a verification task on a red suite, and never tick one to get past `/verify` — that converts a real gate into a checkbox. A failing-first (RED) task is the one exception, and only when the task was explicitly to write failing tests.

## Tips

- **Generate before implementing** — failing tests are the spec made executable; implement until green.
- **Mapping comments are load-bearing** — the qa skill traces ACs through them; keep them accurate if tests move or split.
- **A red test that compiles is RED; a test that won't load is just broken** — fix setup errors before trusting any failure.
- **Don't tick verification tasks on a red suite** unless the task was explicitly to write failing tests.
