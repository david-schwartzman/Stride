---
name: consistency-check
description: Asks which file to check, then sweeps the whole project for anything that file contradicts — other docs, specs, standards, indexes, code — plus internal errors that would compound if later work builds on it. Use right after the agent creates or edits a file, or when asked to check a file for contradictions, conflicts, inconsistencies, or drift against the rest of the project.
---

# Consistency Check

A file the agent just wrote becomes input for the next file it writes. If it disagrees with the rest of the project — a different field name, a status that doesn't match the epic, a decision the architecture already ruled out — every later file inherits the mistake. This skill catches that before it compounds.

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **Read-only** — report findings; never edit the target or any other file unless the user asks after the report
- **Evidence over opinion** — every finding cites both sides: `target:line` and `other-file:line`, quoted
- **Contradiction ≠ difference** — two files covering different things is fine; flag only claims that can't both be true, or a gap that will make the next step go wrong

## Step 1: Ask Which File

Collect candidates from `git status --porcelain` and `git diff --name-only HEAD~1` (recently created/modified files first, skip `.DS_Store` and build output). Use AskUserQuestion: "Which file do you want to check?" with up to 4 of those candidates as options; the user can type any other path via "Other".

Resolve the answer to a real path — if it's a bare name, search the repo for it; if several files match, ask which one (one question). If nothing matches, say so and stop.

## Step 2: Extract the Target's Claims

Read the whole target file. List every concrete, checkable claim it makes:

- **Names** — entities, fields, routes, endpoints, components, files, env vars, slugs, IDs
- **Values** — numbers, limits, enums, statuses, dates, versions
- **Decisions** — tech choices, behaviors, scope in/out, ownership
- **References** — links/paths to other files, IDs like `AC3`, `T2`, spec or epic slugs
- **Structure** — frontmatter, required sections, template grammar the file type follows

Keep this list in working memory; it drives the search.

## Step 3: Find Related Files

Search the project for anything that talks about the same things:

1. **Explicit links** — every path, slug, or ID the target references; verify each exists.
2. **Hierarchy** — for files under `softwareos/`: the parent epic.md, product docs (`mission.md`, `roadmap.md`, `architecture.md`, `tech-stack.md`, `dependencies.md`), sibling specs in the same epic, `index.yml`/`specs.index.yml` files, and `softwareos/standards/`.
3. **Backlinks** — grep for the target's filename, slug, and title; those files make claims about it.
4. **Shared terms** — grep the key names and values from Step 2 across the repo (docs and code).
5. **Templates/conventions** — another file of the same kind (e.g. another spec.md) shows the expected shape.

For a large sweep, dispatch the `code-explorer` agent (project agent) with the claim list and ask it to return every file:line that mentions each claim. Never use a global agent or skill.

## Step 4: Check

Compare the target's claims against what you found, plus check the target against itself:

| Category | Examples |
|---|---|
| **Contradiction** | target says "email + password auth"; architecture.md says "magic links only" |
| **Naming drift** | `userId` here, `user_id` in the data model; spec slug differs from folder name |
| **Value mismatch** | session TTL 7d vs 30d; status `in-progress` here, `planned` in the epic/index |
| **Broken reference** | links to a file, AC, task, or spec that doesn't exist or was renamed |
| **Index/registry drift** | file not listed in its `index.yml`, or listed with a different title/status |
| **Scope conflict** | claims work another spec or epic already owns; does something the epic marks out of scope |
| **Standards violation** | breaks a rule in `softwareos/standards/` |
| **Internal inconsistency** | file contradicts itself; AC with no task; task with no AC; numbering gaps |
| **Structural error** | missing required section/frontmatter vs. siblings of the same type |
| **Ambiguity that will compound** | an undefined term or "TBD" that a later step must guess at |

When two files disagree, note which one is likely the source of truth (product docs > epic > spec > tasks; newer decision in a Changelog > older text) — but don't assume the target is the one that's wrong.

## Step 5: Report

Print in chat:

```
# Consistency Check — <target path>

Checked against N files · Verdict: CLEAN | ISSUES FOUND

## Findings

### 1. [high|med|low] <category> — <one line>
- Target: `<path>:<line>` — "<quote>"
- Conflicts with: `<path>:<line>` — "<quote>"
- Why it compounds: <what goes wrong downstream if left>
- Suggested fix: <which file to change, and to what>

## Checked, no issues
- <file> — <what was compared>
```

Severity: **high** = a later step will build the wrong thing; **med** = will cause confusion or rework; **low** = cosmetic or naming polish.

Then use AskUserQuestion: fix the findings now (list which), fix only high-severity, or leave as is. Only edit after the user picks; for `softwareos/` specs, changes to an existing spec go through `/spec-changes` so the Changelog stays intact.

## Tips

- **Run it right after creating a file** — the cheapest moment to fix a contradiction is before anything references it.
- **Check the claim, not the wording** — "auth via Supabase" and "Supabase handles login" agree.
- **Silence is a finding too** — if a sibling spec defines a field the target uses but never mentions, that's fine; if the target depends on something nothing defines, flag it.
