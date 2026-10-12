---
name: project-audit
description: Read-only, top-down audit of the whole SoftwareOS project (customer → product docs → standards → epics → specs → indexes, plus root docs and app code) for serious gaps and contradictions — cross-level conflicts, two specs claiming one route, status drift, unshaped planned specs, ACs with no task, broken references, stale QA evidence, index drift, compounding TBDs, superseded root docs. Prints a severity-ranked report with path:line quotes and the fixing command, then asks which to fix. Use for /project-audit, or when the user says "audit the project", "check everything for gaps", "find contradictions across the specs", "health check the docs", or after /update-arch or several /shape-spec runs. Optional scope — a product, an epic, or "specs only". Not for checking one file (consistency-check), an architecture change (/update-arch), status reporting (/project-status), a code diff (/code-review), production readiness (/go-production), or rebuilding indexes (/refresh-indexes).
---

# Project Audit

Every level of SoftwareOS is written against the level above it: specs follow the epic's tech plan, which follows the product's architecture, which follows the customer's stack. When a higher level changes and a lower one doesn't, or two siblings quietly disagree, the next agent reads the wrong file and builds the wrong thing. `consistency-check` catches that for one file right after it's written. This skill catches it everywhere at once — the drift that piles up across many edits, many sessions and many commands.

## Ground rules

- **Read-only.** Don't edit, create, rename or delete anything — not even an index you know is stale. The output is a report in chat. Fixing happens afterwards, through the command each finding names, and only for findings the user picks.
- **Higher level wins.** Customer > product docs > standards > epic (epic.md, tech-plan.md, product-brief.md) > spec > tasks > indexes. When two levels disagree, the lower one is presumed wrong — unless the lower one has a newer, explicit Changelog row deciding otherwise, in which case the higher doc is the stale one. Say which side you think is the source of truth and why.
- **The filesystem is the truth for what exists.** Enumerate products, epics and specs from folders, never from `index.yml` — indexes are one of the things being audited.
- **Evidence or it isn't a finding.** Every high/med finding quotes both sides with `path:line`. If you can't point at the line, you don't have a finding.
- **Contradiction ≠ difference.** Two docs covering different details is normal. Flag only claims that can't both be true, gaps that will make a later step go wrong, or structure the commands depend on. A long report of nitpicks hides the three findings that matter.
- **Project agents and skills only.** Dispatch the project's `code-explorer` agent for sweeps. Never use a global agent or skill, even if one looks like a fit.
- **Ask with AskUserQuestion.**

## Step 1: Scope and inventory

Read the user's request for a scope. Default is the whole project. Supported narrower scopes:

| Scope | What's audited |
|---|---|
| *(none)* | Everything: customer, every product, standards, every epic and spec, all indexes, root docs, code |
| a product slug | That product's docs, its epics/specs/indexes, standards, root docs that mention it |
| an epic slug | That epic's docs and specs, checked against its product docs and standards; its `specs.index.yml`; cross-epic ownership collisions involving its specs |
| "specs only" | Every spec folder (internals, ownership, status vs epic.md, evidence, refs), against the docs above them, but the upper levels aren't audited for their own issues |

A narrower scope still *reads* the levels above it — you can't judge a spec without its tech plan — it just doesn't report findings that live only in those upper files.

Then build the inventory:

1. `git rev-parse --show-toplevel`; read `softwareos/config.yml` (`mode`, `customer_root`). If `customer_root` is set, customer docs live there.
2. List from the filesystem: `softwareos/customer/*`, `softwareos/ecosystem/*`, each `softwareos/products/<p>/` and its docs, `softwareos/standards/**`, each `epics/<e>/` with its docs, each `specs/<folder>/` with its files, and every `*.index.yml` / `index.yml`.
3. Root docs: markdown outside `softwareos/` — `design-rationale.md`, `INFRA_PLAN.md`, `README.md`, design or handoff folders' markdown. Skip `.claude/`, `node_modules/`, `.git/`, build output.
4. Code: does application code exist (e.g. `src/`, `app/`, `package.json` with real source)? If not, note "no code yet" and skip the code checks.
5. `mode` matters: in `production`, missing verification tasks or missing QA on a `done` spec are higher severity; in `setup` they're low.

## Step 2: Build the source-of-truth digest

Read the top levels fully yourself — they're short, and every later check is measured against them:

- customer `tech-stack.md` (and `overview.md` for scope)
- product `architecture.md`, `tech-stack.md`, `dependencies.md`, `mission.md`, `roadmap.md`
- every standard under `softwareos/standards/`

Write a compact **digest**: the concrete, checkable claims — chosen tech and versions, explicitly ruled-out options, routes and who the architecture says owns them, data models and field names, env vars, runtime constraints (edge/Node), session/auth model, Gotchas, standard rules (branch names, commit format, testing requirements). Include `path:line` for each, so findings can quote them. Also list the roadmap's epics and their order, and each epic's planned specs from `tech-plan.md` Candidate Specs and `epic.md`.

This digest is what sub-agents get in Step 3, so it has to stand on its own.

## Step 3: Sweep

The full list of checks, with examples and default severity, is in `references/checks.md`. Read it now.

**Small tree** (roughly ≤ 3 epics that have specs, or ≤ 10 specs total): run every check yourself.

**Bigger tree:** split the per-epic work across `code-explorer` agents — one per epic that has docs worth checking — launched in a single turn so they run in parallel. Give each:

- the epic path and the list of files in it
- the digest from Step 2 (pasted in, not "go read the product docs")
- the checks from `references/checks.md` sections C, D and E (epic, spec internals, references/evidence) — paste or point to the file path
- the instruction: read-only; return raw findings as a list, each with category, proposed severity, both sides quoted with `path:line`, and one line on downstream impact; also return a "checked, no issues" line per file; plus every spec's slug, folder, Status, `> Covers:` entries, branch, task counts by state, and Changelog last date — you need these for cross-epic checks

While they run, do the cross-cutting checks yourself — the ones no single epic can see: product and standards level (A, B), ownership collisions across epics (D-ownership), indexes (F), root docs (G), code (H).

## Step 4: Merge and verify

Agents over-report. Before anything reaches the user:

1. **Re-check every high and med finding yourself** — open both cited lines. Drop it if the quote isn't there, if the two claims are actually compatible, or if a newer Changelog row already resolves it.
2. **Dedupe.** One root cause appearing in five specs is one finding with five locations, not five findings. A stale index that misses three specs is one finding.
3. **Set severity** by downstream impact, not by category:
   - **high** — something will be built wrong, or two specs will collide (same route/file, contradictory behavior, a ruled-out tech in a Technical Approach, a missing spec the roadmap depends on)
   - **med** — rework or confusion (status drift, AC with no task, stale QA evidence, root doc describing an old decision, undefined term others build on)
   - **low** — cosmetic (formatting, a missing optional section, index `generated:` date, wording)
4. **Name the fix** for each, using the routing table in `references/checks.md` (§ Fix routing). One command per finding; if the fix spans levels (an architecture decision not cascaded), the command is `/update-arch`.

## Step 5: Report (in chat — no file)

```
# Project Audit — <scope>

Checked <N> files across <levels> · Verdict: CLEAN | ISSUES FOUND
High: <n> · Med: <n> · Low: <n>

## High

### Product → Specs
**H1. <category> — <one line>**
- `<path>:<line>` — "<quote>"
- `<path>:<line>` — "<quote>"
- Source of truth: <which side, and why>
- Why it matters: <what goes wrong downstream if left>
- Fix: `<command> <target>` — <what to change, one line>

### Epic → Specs
**H2. …**

## Med

### <level group>
**M1. …**   (same fields)

## Low
- L1 `<path>:<line>` — <one line> → `<fix>`
- L2 …

## Checked, no issues
- Customer — <files>
- Product <p> — <files>
- Standards — <files>
- Epic <e> — <files>, specs: <slugs>
- Indexes — <files>
- Root docs — <files>
- Code — <"no code yet" | what was compared>
```

Group findings within a severity by the level boundary they sit on — "Product → Epic", "Epic → Specs", "Spec ↔ Spec", "Spec internals", "Indexes", "Root docs", "Code ↔ Specs" — in top-down order. Number findings (`H1`, `M3`, `L2`) so the user can refer to them.

A section with nothing in it says "none" rather than vanishing; the user wants to see that it was considered. If the verdict is CLEAN, still show the "Checked, no issues" list — that's the evidence the audit happened.

## Step 6: Ask which to fix

Use AskUserQuestion (multiSelect) to ask which findings to fix. Offer sensible groupings as options — e.g. "All high", "All high + med", "Index drift only", or specific findings by ID — the user can type IDs via "Other".

Then, for what they picked, list each finding with the exact command to run, ordered top-down (product doc fixes before the specs that depend on them; `/refresh-indexes` last, since spec fixes change what the index should say). Don't run the commands or edit files yourself unless the user explicitly asks you to proceed — and if they do, follow each command's own rules (spec edits go through `/spec-changes` so the Changelog stays intact).

## Tips

- **Read the Changelog before calling something drift.** A spec that disagrees with the tech plan may be the *newer* decision; then the finding is "tech-plan.md is stale", not "the spec is wrong".
- **Check the claim, not the wording.** "Sessions are JWTs in an httpOnly cookie" and "Auth.js JWT strategy" agree.
- **Silence can be a finding.** A Risk in the tech plan that a spec has to resolve to be built, but neither the spec nor its Out of Scope mentions — flag it. A detail one doc includes and another omits is not.
- **Placeholder vs. ownership.** A spec that ships a throwaway file another spec will own (and says so) isn't a collision. Two specs whose `> Covers:` both claim it is.
