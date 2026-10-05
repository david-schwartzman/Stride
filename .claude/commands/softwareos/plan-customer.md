---
description: Onboard a new customer — create softwareos/ customer docs (overview, team, tech stack, repos) and config.yml
---

# Plan Customer

One-time customer onboarding through an interactive conversation. Creates `softwareos/customer/` docs and updates `softwareos/config.yml`. This is the entry point for a new customer — it creates the `softwareos/` structure if it doesn't exist yet. Rerun anytime to update.

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`. If it succeeds, `<root>` is the SoftwareOS root candidate. If not a git repo, walk up from cwd looking for an existing `softwareos/`; if none found, use cwd as the root.
2. If `<root>/softwareos/` does not exist, that's fine — this command is the entry point for a new customer. Tell the user you'll create `softwareos/` and `softwareos/config.yml` as part of generation (Step 8). Do not stop.
3. If `softwareos/config.yml` exists and sets `customer_root`, the full customer docs live in the hub repo at that path — update mode operates on those files. If the path doesn't exist on disk, say so and offer to update only the local stub.
4. Enumerate existing docs from the filesystem, never from caches or memory.

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **One question at a time** — wait for each answer
- **Offer suggestions** — present options the user can confirm, adjust, or correct
- **Never invent facts** — unknown contact, URL, or date = "TBD"
- **Keep it lightweight** — brief answers are fine; docs can grow later

## Process

### Step 1: Check for Existing Customer Docs

Check `softwareos/customer/` (or `<customer_root>/softwareos/customer/` if `customer_root` is set) for: `README.md`, `overview.md`, `team.md`, `tech-stack.md`, `repos.md`.

**If any exist**, this is a rerun — default to update mode. Use AskUserQuestion:

```
I found existing customer documentation:
- README.md: [exists/missing]
- overview.md: [exists/missing]
- team.md: [exists/missing]
- tech-stack.md: [exists/missing]
- repos.md: [exists/missing]

Would you like to:
1. Update specific files (recommended)
2. Start fresh (replace all)
3. Cancel
```

If option 1, ask which files to update and run only the matching steps (overview → Step 3, team → Step 4, tech-stack → Step 5, repos → Step 6). README.md is regenerated automatically. Skip Step 2 unless the customer name/slug is missing from `config.yml`, and skip Step 7.5 unless `mode:` is absent.
If option 3, stop here.

**If nothing exists**, proceed to Step 2.

### Step 2: Identify the Customer

Use AskUserQuestion:

```
Who is the customer? Name + one line on their business.
```

Derive a kebab-case slug from the name (e.g. "Acme Corp" → `acme-corp`) and confirm it — it goes into `config.yml` and names the hub repo (`<slug>-os`) if one is used.

### Step 3: Business Goals & Engagement (overview.md)

Use AskUserQuestion:

```
What are they trying to achieve, and what is Moveo engaged to deliver?

(Scope, success measures, timeline if known — brief is fine)
```

Sort the answer into the overview.md sections (Business, Goals & Engagement, Success Measures, Key Dates). Anything unknown = "TBD".

### Step 4: Team & Contacts (team.md)

Use AskUserQuestion:

```
Who's involved — Moveo side and customer side?

For each person: name, role (PM / Dev / Design / Customer-side), contact.
(Brief answers are fine — I'll format the table)
```

Format into the team.md table. Unknown contacts = "TBD", never invented.

### Step 5: Org Tech Stack (tech-stack.md)

Check if `softwareos/standards/global/tech-stack.md` exists.

**If it exists**, read it and use AskUserQuestion:

```
I found a tech stack standard:

[Summarize key technologies from standards/global/tech-stack.md]

Does this customer use the same stack, or does it differ?

1. Same as standard (use as-is)
2. Differs (I'll specify)
```

**If no standard exists** (or they chose 2), use AskUserQuestion:

```
What does this customer's org-wide tech stack look like?

- Frontend / Backend / Data / Infra & services
- Any org-wide conventions (or N/A)
```

### Step 6: Repos (repos.md)

Use AskUserQuestion:

```
Which repos make up this customer's codebase?

For each: name, URL, what it contains, default branch.
```

If the `gh` CLI is installed, offer a cross-check (if `gh` is missing, skip this silently — manual entry only):

```
Want me to cross-check against GitHub? I'll run `gh repo list <org>` and flag any repos we missed.
```

For each repo, ask (or infer and confirm) which product it belongs to — "TBD" if products aren't defined yet. Build the repos.md table with the Product column.

### Step 7: Hub Decision (only if more than one repo)

**Skip this step if there is exactly one repo** — this repo holds the full docs; no `customer_root`.

If there are multiple repos, use AskUserQuestion:

```
This customer spans multiple repos. Full customer + ecosystem docs live in exactly ONE hub repo — the others get a stub pointing to it.

Where should the hub be?

1. A dedicated hub repo `<customer>-os` (recommended) — other repos point to it via customer_root
2. This repo
```

**If option 1** (this repo is NOT the hub):
- Ask for the hub checkout path relative to this repo (suggest `../<customer>-os`); record it as `customer_root` in `config.yml`.
- This repo gets only the stub `customer/README.md` (see Output) — not the full docs.
- If the hub path exists on disk, write the full docs to `<customer_root>/softwareos/customer/`. If it doesn't, offer to create the scaffold there. If declined, fall back to treating this repo as the hub for now (full docs local, no `customer_root`) and note the user can migrate later by moving `softwareos/customer/` + `ecosystem/` to the hub and setting `customer_root`.

**If option 2** (this repo IS the hub): full docs live here, no `customer_root`. Note that other repos, when onboarded, get a stub pointing back to this repo.

### Step 7.5: Project Mode

**Skip this step entirely if `config.yml` already has a `mode:` key** — the regime is already decided, and this command doesn't change it. Point the user at `/go-production` if they want it changed.

Otherwise ask — don't assume. Use AskUserQuestion:

```
What mode should this project run in?

1. setup — normal for a new project: lightweight gates, tests and QA optional
   per spec while the shape of the work is still moving. Switch later with
   /go-production.
2. production — this repo already serves live traffic (e.g. you're adding
   SoftwareOS to something in flight). Every spec will demand unit tests,
   security review, and full QA; /verify, the qa skill, and the pr preflight
   will fail on missing verification.
```

`setup` is the usual answer here because this command onboards a *new* customer — but "usually" isn't "always", and the consequence of getting it wrong is either false confidence or friction on every spec. So ask, state what each choice costs, and write what they answer.

Present a one-screen summary before writing anything:

```
Ready to write:

Customer: <name> (slug: <slug>)
Hub: <this repo | <customer>-os at <path> | n/a (single repo)>

Files:
- <path>/softwareos/customer/README.md       [+ overview, team, tech-stack, repos]
- softwareos/customer/README.md (stub)       [only if this repo is not the hub]
- softwareos/config.yml                      [customer, customer_root?, default_branch, mode]

Approve / adjust / cancel?
```

On approval:
1. Create `softwareos/` and `softwareos/customer/` if missing (at the hub location and/or locally per Step 7).
2. Write the files from the templates below.
3. Create or update `softwareos/config.yml` — set `customer`; set `customer_root` only when this repo is not the hub; set `default_branch` (detect via `git symbolic-ref --short refs/remotes/origin/HEAD`, fallback `main`); write `mode:` from the answer to Step 7.5 — **only when the key is absent**, never overwriting an existing one.

Then output:

```
✓ Customer documentation created:

  [list of files written, with paths]

Next steps:
- Multiple products? Run /plan-ecosystem (in the hub repo) to map them.
- Then run /plan-product in each product repo.
```

## Output

```
softwareos/
├── config.yml
└── customer/
    ├── README.md        # onboarding index (hub) or stub (non-hub)
    ├── overview.md
    ├── team.md
    ├── tech-stack.md
    └── repos.md
```

## config.yml Content

```yaml
version: 1.0.0
customer: acme                 # kebab-case slug from Step 2
customer_root: ../acme-os      # only when this repo is NOT the hub; omit otherwise
default_branch: main
mode: setup                    # setup | production — from Step 7.5; see softwareos/README.md
```

If `config.yml` already exists (installer-created), update only these keys — preserve everything else. **Never change an existing `mode:`** — this command onboards a customer, it doesn't decide the verification regime; `/go-production` owns that transition. Write `mode:` only when the key is absent, and only from the user's answer in Step 7.5 — never from an assumption about the project.

## README.md Content (hub / single repo)

```markdown
# <Customer Name> — Customer Docs

New here? Read in order:

1. [overview.md](overview.md) — business, goals, engagement
2. [team.md](team.md) — who's who and how to reach them
3. [tech-stack.md](tech-stack.md) — org-wide stack and conventions
4. [repos.md](repos.md) — repo index
5. [../ecosystem/ecosystem.md](../ecosystem/ecosystem.md) — products + shared services (if present)
6. Each repo's `softwareos/products/<product>/mission.md`
```

## README.md Content (stub — non-hub repo)

```markdown
# <Customer Name>

Customer hub: <hub repo URL>

Full customer and ecosystem docs live there. This repo points to the hub via `customer_root` in `../config.yml`.
```

## overview.md Content

```markdown
# <Customer Name> — Overview

## Business

[One-liner + what they do — from Step 2/3]

## Goals & Engagement

[What they're trying to achieve; what Moveo is engaged to deliver — scope]

## Success Measures

[How success is judged — or "TBD"]

## Key Dates

[Deadlines, milestones — or "TBD"]
```

## team.md Content

```markdown
# <Customer Name> — Team & Contacts

| Name | Org | Role | Contact | Notes |
|---|---|---|---|---|
| [name] | Moveo / <Customer> | PM / Dev / Design / Customer-side | [email/handle or TBD] | [optional] |
```

## tech-stack.md Content

```markdown
# <Customer Name> — Tech Stack

## Frontend

[Technologies, or "N/A"]

## Backend

[Technologies, or "N/A"]

## Data

[Databases, queues, warehouses — or "N/A"]

## Infra & Services

[Hosting, CI, third-party services — or "N/A"]

## Conventions

[Org-wide conventions worth knowing — or "N/A"]
```

## repos.md Content

```markdown
# <Customer Name> — Repos

| Repo | URL | Contains | Default branch | Product |
|---|---|---|---|---|
| [name] | [url or TBD] | [what's in it] | [main] | [product or TBD] |
```

## Tips

- **Rerun = update** — running /plan-customer again defaults to updating specific files, not replacing.
- **Brief answers are fine** — docs can be expanded later; "TBD" beats invented facts.
- **Single-repo customer** — no hub question, no `customer_root`; this repo holds everything.
- **No `gh`?** — manual repo entry works fine; the cross-check is just a convenience.
- **What's next** — /plan-ecosystem if the customer has multiple products; otherwise go straight to /plan-product in the product repo.
