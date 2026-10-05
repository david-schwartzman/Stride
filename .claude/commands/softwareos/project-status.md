---
description: Read-only status report across products and epics — task progress, branches, devs, PRs, flags, totals
argument-hint: "[--fetch] [epic-slug]"
---

# Project Status

Render a read-only status report across all epics: task progress parsed from each spec's `tasks.md`, branch and committer activity from git, open PRs from GitHub, then FLAGS and TOTALS. This is a report, not an interview — the only question ever asked is fetch consent. Output goes to chat; never write files.

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if it succeeds and `<root>/softwareos/` exists, that's the SoftwareOS root. If not a git repo, walk up from cwd looking for `softwareos/`.
2. If not found: tell the user this repo isn't onboarded — run `/plan-customer` (new customer) or the installer (`project-install.sh`) first. Stop.
3. Read `softwareos/config.yml`. If `customer_root` is set, read customer/ecosystem docs from that path instead of locally (if the path doesn't exist on disk, say so and continue with local stubs).
4. Resolve `mode:` per `/go-production` → [Reading the mode](./go-production.md#reading-the-mode). Put it in the report header (with the warning line, if the resolution surfaced one) and enable the GAP flag in Step 6.
5. Enumerate from the filesystem, never from caches: products = dirs under `softwareos/products/`; epics = dirs under `products/<product>/epics/`; specs = dirs under `products/<product>/epics/<epic>/specs/` (also read legacy flat `softwareos/epics/<epic>/specs/`).

## Important Guidelines

- **Read-only** — never write or edit files; the only git mutation allowed is `git fetch --prune`, with consent
- **Always use AskUserQuestion tool** when asking the user anything — here that is only the fetch-consent question
- **One question at a time** — wait for each answer (moot here: there is at most one)
- **Degrade, don't fail** — missing git/gh/metadata drops columns with a one-line note; never abort the report
- **Never invent data** — anything unparseable renders as `?`

## Arguments

- `--fetch` — run `git fetch --prune` without asking
- `epic-slug` — limit the report to one epic; unknown slug → list available epic slugs and stop

## Process

### Step 1: Enumerate

Glob from the SoftwareOS root (nested layout; also read legacy flat `softwareos/epics/*` if present):

- `softwareos/products/*/epics/*/epic.md` → epics (grouped by their parent product; dir name = epic slug)
- `softwareos/products/*/epics/*/specs/*/spec.md` → all specs (folder name = `YYYY-MM-DD-<spec-slug>`)
- `softwareos/products/*/epics/*/specs/*/tasks.md` → specs with task lists (absent for PM-only specs)

If an `epic-slug` argument was given, keep only that epic (across products).
If zero products/epics exist: print `Nothing to report yet — run /join-project (existing codebase) or /plan-epic.` and stop.
If `config.yml` sets `customer_root` (or `customer/repos.md` lists multiple repos), note in the report header: this covers the current repo only — run `/project-status` in each repo for the full picture.

### Step 2: Parse Each tasks.md (grammar contract)

Metadata — match `^> (Epic|Spec|Branch|PR|Reviewed|SecurityReviewed): ` within the **first 15 lines only**:

```bash
head -15 "$f" | sed -n -e 's/^> Branch: //p' -e 's/^> PR: //p' \
                       -e 's/^> Reviewed: //p' -e 's/^> SecurityReviewed: //p'
```

`> Reviewed:` / `> SecurityReviewed:` are written by `/code-review` as `YYYY-MM-DD <verdict>`. They're optional — absent means no review has been recorded, which is only a finding in `production` mode (see the GAP flag). A value containing `(stale` was invalidated by `/spec-changes`: the spec was amended after the review, so treat it as no valid review.

Task counts — task lines match `^- \[<state>\] T<n>` or `T<n>.<m>` (a `grep -c` printing `0` exits non-zero; use the printed count):

```bash
DONE=$(grep -cE '^- \[x\] T[0-9]+(\.[0-9]+)? ' "$f")
PROG=$(grep -cE '^- \[~\] T[0-9]+(\.[0-9]+)? ' "$f")
CANC=$(grep -cE '^- \[-\] T[0-9]+(\.[0-9]+)? ' "$f")
ALL=$(grep -cE  '^- \[[ x~-]\] T[0-9]+(\.[0-9]+)? ' "$f")
TOTAL=$((ALL - CANC))          # cancelled excluded from the denominator
```

Render Tasks as `DONE/TOTAL`, Prog as `~PROG`. Assignees — trailing `@github-handle` on non-cancelled task lines:

```bash
grep -E '^- \[[ x~]\] T[0-9]' "$f" | grep -oE '@[A-Za-z0-9-]+$' | sort -u
```

Also read per spec folder: `> Status:` from `spec.md` (shaped | in-progress | done) and whether `qa-report.md` exists — both feed the DRIFT flag. A spec with no `tasks.md` renders Tasks/Prog as `—`.

### Step 3: Parse Epic Metadata

- Per epic (note its parent product): `> Status:` from `epic.md`; `brief: yes/no` = `product-brief.md` exists; `tech-plan: yes/no` = `tech-plan.md` exists.

### Step 4: Git Layer

Skip this whole step (degraded mode, see table below) if `git` is missing or `git rev-parse --is-inside-work-tree` fails.

**Fetch consent.** If `--fetch` was passed, run `git fetch --prune` directly. Otherwise use AskUserQuestion (the command's only question):

```
Refresh remote refs with `git fetch --prune`? Read-only for your working tree.

1. Yes — fetch now
2. No — use existing refs (report labeled "as of last fetch")
```

**List branches:**

```bash
git for-each-ref refs/remotes --format='%(refname:short)|%(committerdate:iso)|%(authorname)'
```

Strip the remote prefix from each ref (`origin/feat/a/b` → `feat/a/b`: remove up to the first `/`). Ignore `origin/HEAD`. If `refs/remotes` is empty (no remote configured), fall back to `refs/heads` with the same format and note "local branches only".

**Match branches → specs/bugs**, in this order (first match wins; a branch matches at most one item):

1. **Exact:** stripped ref equals the spec's `> Branch:` metadata value.
2. **Parallel:** stripped ref matches `^<branch-metadata-value>--t[0-9]+$`.
3. **Suffix fallback** (no metadata, or no ref matched it): derive `<spec-slug>` by stripping the date prefix from the spec folder name (`sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}-//'`); stripped ref matches `^feat/[^/]+/<spec-slug>(--t[0-9]+)?$`.
4. **Hotfix:** a `hotfix/<epic-slug>/<slug>` ref maps to the spec it fixes (via that spec's hotfix Changelog rows, or by `<slug>`/keyword against spec folders).
5. Any remaining `feat/*/*` or `hotfix/*/*` ref is an **ORPHAN** (`chore/*` and other branches are never flagged).

**Per matched branch:** last activity = the committer date from `for-each-ref`; devs = top 2 committers ahead of the default branch (`default_branch` from `config.yml`, fallback `main`; compare on the same side you read refs from — `origin/<default>` for remote refs):

```bash
git log origin/<default_branch>..origin/<branch> --format='%an' | sort | uniq -c | sort -rn | head -2
```

If that range is empty (merged or just branched), Dev(s) falls back to the tasks.md `@assignees` from Step 2.

### Step 5: GitHub Layer

Only if `gh` is installed AND `gh auth status` exits 0:

```bash
gh pr list --state open --json headRefName,author,url,isDraft
```

Join `headRefName` against the stripped branch names from Step 4. Render PR as `#<n>` (trailing number of `url`), appending `(draft)` when `isDraft`. If `gh` is unavailable or unauthenticated: fall back to each tasks.md `> PR:` value where present, and add one line under the header: `gh unavailable — PR column from tasks.md metadata only.`

### Step 6: Compute Flags

- **STALE** — matched branch whose committer date is older than 7 days vs today AND its spec has open (`[ ]`) or in-progress (`[~]`) tasks.
- **DRIFT** — spec.md `> Status: done` but `qa-report.md` missing in the spec folder, **or present with a `> Stale:` line** (invalidated by `/spec-changes`, so the spec is done against evidence that no longer covers it). Say which of the two it is.
- **ORPHAN** — `feat/*/*` or `hotfix/*/*` branch that matched no spec or bug (Step 4.5).
- **GAP** — **`production` mode only.** A spec that the mode's gates would reject: `> Status: done` with no `> Reviewed:` line (or one marked `(stale`), or a spec with no Verification group in `tasks.md` at all (shaped before the mode flipped), or acceptance criteria still carrying a pending marker. One line per spec, naming which gap. These are exactly what `/go-production` audits — GAP here means the project drifted after the transition, so point at the specific tool (`/code-review`, `/shape-spec` as PM) rather than at `/go-production`.

GAP is never emitted in `setup` mode — none of those states are failures there.

### Step 7: Render

Output to chat in exactly this shape — one block per epic, then FLAGS, then TOTALS:

```
PROJECT STATUS — <customer>/<repo> · mode: production · 2026-06-11 · refs fetched just now   ← or "refs as of last fetch"
(multi-repo customer: this report covers the current repo only)           ← only when applicable

PRODUCT: web-store
EPIC: checkout-redesign (active) · brief: yes · tech-plan: yes
| Spec | Tasks | Prog | Branch | Dev(s) | PR | Last activity |
|---|---|---|---|---|---|---|
| 2026-03-04-checkout-flow | 5/9 | ~2 | feat/checkout-redesign/checkout-flow | alice, bob | #142 (draft) | 2026-06-01 |
| 2026-04-12-promo-codes | 0/6 | ~0 | feat/checkout-redesign/promo-codes (no ref) | @carol | — | — |

EPIC: payments (done) · brief: yes · tech-plan: no
| Spec | Tasks | Prog | Branch | Dev(s) | PR | Last activity |
|---|---|---|---|---|---|---|
| 2026-04-01-refund-api | 7/7 | ~0 | feat/payments/refund-api | carol | — | 2026-05-30 |

FLAGS
- STALE: feat/checkout-redesign/checkout-flow — last commit 2026-06-01 (10 days), 4 open tasks
- DRIFT: payments/2026-04-01-refund-api — spec done but qa-report.md stale since 2026-08-02
- ORPHAN: feat/checkout-redesign/quick-buy — matches no spec
- GAP: payments/2026-04-01-refund-api — done with no > Reviewed: line (run /code-review)

TOTALS: 2 epics · 3 specs · tasks 12/22 done · 3 active branches · 1 open PR
```

Rendering rules:

- Header: always show `mode: setup` or `mode: production` — the flags mean different things under each.
- Branch column: matched ref name; if no ref matched, the `> Branch:` metadata value plus `(no ref)`; `?` if metadata is also absent.
- Group epics under a `PRODUCT: <product>` header (epics from the same product listed together).
- `FLAGS: none` on one line when nothing is flagged.
- TOTALS: epics shown · specs shown · summed `done/total` across all tasks.md · active branches = distinct matched `feat`/`hotfix` refs · open PRs = Step 5 join count.

## Degradation

| Condition | Behavior |
|---|---|
| No git (or not a repo) | Tasks-only table: Dev(s)/Last activity render `—`, Branch/PR from tasks.md metadata; one-line note |
| Shallow clone / detached HEAD | Use whatever refs exist; no special handling |
| No remotes | Read `refs/heads` instead; note "local branches only" |
| gh missing or unauthenticated | Omit PR join; `> PR:` metadata only, one-line note |
| Multi-repo customer | Current repo only; say so in the header |
| Zero epics | Friendly pointer to /plan-epic; stop |
| Spec without tasks.md (PM-only) | Row kept; Tasks/Prog `—` |
| Malformed tasks.md | Render `?` in affected cells; mention the file once under FLAGS |

## Tips

- Run with `--fetch` before standup; pass an epic slug to keep a big project's report on one screen.
- `?` cells almost always mean a tasks.md drifted from the grammar — fix the file, not the report.
- STALE + assigned dev is a nudge-someone signal; ORPHAN usually means a branch skipped /shape-spec.
- Run this before `/go-production` — DRIFT and GAP are largely the same gaps its audit will block on, so you can clear them first.
