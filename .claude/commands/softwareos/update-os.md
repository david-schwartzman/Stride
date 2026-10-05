---
name: update-os
description: Pull SoftwareOS updates into this project — detects local changes and resolves conflicts (keep/take/blend) instead of overwriting
---

# /update-os

Update this project's installed SoftwareOS assets (commands, skills, agents, hooks, standards) from the base SoftwareOS installation. The core promise: **nothing the team changed is ever overwritten silently.** The script layer (`project-update.sh`) detects and places files; you explain, diff, ask, and blend.

## Locating the base installation

The updater is `scripts/project-update.sh` **inside the SoftwareOS base clone** (not in this project). Find the clone, in order:

1. `$SOFTWAREOS_HOME` environment variable, if set.
2. `base_path:` in this project's `softwareos/config.yml`, if present.
3. `base_remote:` in `.claude/softwareos-manifest.yml` — look for an existing clone in common locations (`~/SoftwareOS`, `~/Projects/SoftwareOS`, sibling directories of this project).
4. Otherwise ask the user where their SoftwareOS clone is (offer to clone from `base_remote` if they don't have one). When they answer, offer to save it as `base_path:` in `softwareos/config.yml` so this never gets asked again.

If there is no `.claude/softwareos-manifest.yml` **and** no `.claude/softwareos-manifest.txt`, SoftwareOS isn't installed here — point the user to `<base>/scripts/project-install.sh` and stop.

## Flow

### 1. Refresh the base

Ask the user if they want to pull the latest base first (`git -C <base> pull`). Skip silently if the base isn't a git repo.

### 2. Plan

```bash
cd <project-root> && <base>/scripts/project-update.sh --plan
```

The plan is YAML: `base_commit_old/new` plus buckets — `pull` (upstream improved, they didn't touch), `keep` (they customized, upstream didn't move — stays theirs), `conflict` (both changed), `add`, `add_conflict` (upstream adds a file where the team already has one), `remove`, `remove_conflict` (upstream deleted a file they modified). Files the team created themselves are never listed — they are never touched.

If `legacy_manifest: true` appears, tell the user: this install predates change-tracking, so any file that differs from upstream shows as a conflict once; after this update the new manifest records hashes and future updates will be precise.

### 3. Present the summary

Before any changes, show:

- **What's new upstream** — if the base is a git repo and `base_commit_old` is known:
  `git -C <base> log --oneline <old>..<new> -- commands skills agents hooks profiles`
  Summarize in plain language; don't dump raw log for more than ~10 commits.
- **Bucket counts** — e.g. "12 files will update, 3 you've customized stay yours, 2 conflicts need your call."

If there are no changes at all, say so and stop.

### 4. Resolve conflicts — one at a time

For each `conflict` / `add_conflict` / `remove_conflict` entry:

1. Show what changed on each side. Baseline for three-way context:
   `git -C <base> show <base_commit_old>:<path-relative-to-base>` (the plan's `source:` gives the base-side path). If the base has no git history, fall back to a two-way diff of local vs upstream.
2. Ask, in the meeting's exact spirit: *"You've changed `<file>` — the update also changes it. Keep yours / take the update / blend?"*
3. Record the choice:
   - **keep** → `project-update.sh --resolve <path> --keep`
   - **take** → `project-update.sh --resolve <path> --take`
   - **blend** → merge the intent of both versions yourself, show the merged result, and only after the user approves it: write the merged content to `<path>`, then `project-update.sh --resolve <path> --blended`
   - For `remove_conflict`: "keep" keeps their file although upstream deleted it; "take" deletes it.

The user may also leave conflicts for later — that's fine, unresolved files are left untouched and will be re-detected next run.

### 5. Apply and report

```bash
cd <project-root> && <base>/scripts/project-update.sh --apply
```

Then report: what updated, what stayed local (and why), what was removed, any unresolved conflicts left for next time. Remind the user to commit the changes (including `.claude/softwareos-manifest.yml` — it's the baseline for the next update).

**Announce newly-relevant features that opt-in.** If this update brought in features that existing projects only get by explicit opt-in, mention them in one line so they don't stay invisible. In particular, if `softwareos/config.yml` has no `mode:` key after the apply, add: *"New in 1.2.0: project modes — this project is running as `setup` (the compatibility default). Run `/go-production` when you're ready to opt into strict verification gates."* Print it once, only when the key is genuinely absent.

## Rules

- Never run `--apply` before conflicts are either resolved or explicitly deferred by the user.
- Never edit `.claude/softwareos-manifest.yml` by hand — only the scripts write it.
- Never touch files the plan doesn't mention; team-created files are invisible to this flow by design.
- A "keep" is remembered: the user won't be re-asked unless upstream changes that file *again*.
