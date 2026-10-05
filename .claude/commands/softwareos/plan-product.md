---
description: Establish product documentation — mission, roadmap, tech stack, architecture, dependencies — in softwareos/products/<product-slug>/
---

# Plan Product

Establish foundational product documentation through an interactive conversation. Creates mission, roadmap, tech stack, architecture, and dependencies files in `softwareos/products/<product-slug>/`, and marks the product as documented in the ecosystem registry.

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if it succeeds and `<root>/softwareos/` exists, that's the SoftwareOS root. If not a git repo, walk up from cwd looking for `softwareos/`.
2. If not found: tell the user this repo isn't onboarded — run `/plan-customer` (new customer) or the installer (`project-install.sh`) first. Stop.
3. Read `softwareos/config.yml`. If `customer_root` is set, read customer/ecosystem docs from that path instead of locally (if the path doesn't exist on disk, say so and continue with local stubs).
4. Enumerate from the filesystem, never from caches: products = dirs under `softwareos/products/`; epics = dirs under `products/<product>/epics/`; specs = dirs under `products/<product>/epics/<epic>/specs/`.

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **Keep it lightweight** — gather enough to create useful docs without over-documenting
- **One question at a time** — don't overwhelm with multiple questions
- **Never invent facts** — unknown = "TBD"

## Process

### Step 1: Check for Existing Product Docs

Derive the product's kebab-slug (from its name or repo), then check if `softwareos/products/<product-slug>/` exists and contains any of these files:
- `mission.md`
- `roadmap.md`
- `tech-stack.md`
- `architecture.md`
- `dependencies.md`

**If any files exist**, use AskUserQuestion:

```
I found existing product documentation:
- mission.md: [exists/missing]
- roadmap.md: [exists/missing]
- tech-stack.md: [exists/missing]
- architecture.md: [exists/missing]
- dependencies.md: [exists/missing]

Would you like to:
1. Start fresh (replace all)
2. Update specific files
3. Cancel

(Choose 1, 2, or 3)
```

If option 2, ask which files to update and only gather info for those.
If option 3, stop here.

**If no files exist**, proceed to Step 2.

### Step 2: Inherit Customer & Ecosystem Context

Look for customer and ecosystem docs — locally under `softwareos/customer/` and `softwareos/ecosystem/`, or at `customer_root` if set in config.yml.

**If found**, summarize and confirm with AskUserQuestion:

```
Here's the context I found for this product:

**Customer:** [name] — [one-line goals from customer/overview.md]
**Ecosystem:** this product appears to be **[product name]** — depends on [internal services from ecosystem.md, e.g., "auth-service, cms"]

Is this correct and current?

1. Yes — use it
2. Mostly — I'll correct something
3. Skip this context
```

If option 2, ask what to correct. Carry the confirmed context into later steps (it prefills the dependencies step and the mission.md header).

**If not found**, note it and continue:

```
No customer or ecosystem docs found — continuing without inherited context.
(You can run /plan-customer and /plan-ecosystem later.)
```

### Step 3: Gather Product Vision (for mission.md)

Use AskUserQuestion:

```
Let's define your product's mission.

**What problem does this product solve?**

(Describe the core problem or pain point you're addressing)
```

After they respond, use AskUserQuestion:

```
**Who is this product for?**

(Describe your target users or audience)
```

After they respond, use AskUserQuestion:

```
**What makes your solution unique?**

(What's the key differentiator or approach?)
```

### Step 4: Gather Roadmap (for roadmap.md)

Use AskUserQuestion:

```
Now let's outline your development roadmap.

**What are the existing core features?**

(What does the product already do today? Say "none" if it's greenfield)
```

After they respond, use AskUserQuestion:

```
**What are the must-have features for launch (MVP)?**

(List the core features needed for the first usable version)
```

After they respond, use AskUserQuestion:

```
**What features are planned for after launch?**

(List features you'd like to add in future phases, or say "none yet")
```

### Step 5: Establish Tech Stack (for tech-stack.md)

First, check if `softwareos/standards/global/tech-stack.md` exists.

**If the tech-stack standard exists**, read it and use AskUserQuestion:

```
I found a tech stack standard in your standards:

[Summarize the key technologies from global/tech-stack.md]

Does this project use the same tech stack, or does it differ?

1. Same as standard (use as-is)
2. Different (I'll specify)

(Choose 1 or 2)
```

If they choose option 1, use the standard's content for tech-stack.md.
If they choose option 2, proceed to ask them to specify (see below).

**If no tech-stack standard exists** (or they chose option 2 above), use AskUserQuestion:

```
**What technologies does this project use?**

Please describe your tech stack:
- Frontend: (e.g., React, Vue, vanilla JS, or N/A)
- Backend: (e.g., Rails, Node, Django, or N/A)
- Database: (e.g., PostgreSQL, MongoDB, or N/A)
- Other: (hosting, APIs, tools, etc.)
```

### Step 6: Describe the Architecture (for architecture.md)

Use AskUserQuestion:

```
Now the architecture.

**Describe the high-level architecture** — major components and how they talk.

(Or choose "Explore for me" and I'll explore the codebase and draft this myself)

1. I'll describe it
2. Explore for me
```

**If option 2**: Dispatch the `code-explorer` agent (Agent tool) with: "Map this codebase's major components and responsibilities, how they communicate (calls, queues, events, shared data), environments and deploy targets, and anything unusual an agent must know before changing code (monorepo layout, codegen, deploy quirks)." Present the draft to the user and ask them to confirm or adjust before using it.

After the architecture is described (either path), use AskUserQuestion:

```
**Anything unusual an agent must know before changing code?**

(Monorepo layout, codegen steps, deploy quirks, areas to avoid — or "nothing unusual")
```

### Step 7: Map Dependencies (for dependencies.md)

**If ecosystem context is available** (from Step 2), prefill internal dependencies from the ecosystem's Relationships table and use AskUserQuestion:

```
From the ecosystem map, this product depends on these internal services:

- [service] — provided by [product/repo], used for [purpose]

Is this list correct?

1. Yes
2. I'll adjust it
```

**If no ecosystem context**, use AskUserQuestion:

```
**What internal services does this product depend on?**

(Shared auth, CMS, internal APIs, design system — or "none")
```

Then use AskUserQuestion:

```
**What external services and APIs does this product use?**

(Payments, email, analytics, third-party APIs — name, purpose, and auth method if known; or "none")
```

### Step 8: Generate Files

Show a one-screen summary of what each file will contain and confirm before writing.

Create the `softwareos/products/<product-slug>/` directory if it doesn't exist.

Generate each file based on the information gathered:

#### mission.md

```markdown
# Product Mission

> Customer: [path to customer/overview.md] · Ecosystem: [path to ecosystem.md] — product: [name]

## Problem

[Insert what problem this product solves - from Step 3]

## Target Users

[Insert who this product is for - from Step 3]

## Solution

[Insert what makes the solution unique - from Step 3]
```

Include the `> Customer: …` header line only when customer/ecosystem docs were found in Step 2 (use `customer_root`-relative paths when applicable; omit the `Ecosystem:` part if only customer docs exist).

#### roadmap.md

```markdown
# Product Roadmap

## Core Features (current state)

[Insert existing core features - from Step 4, or "None — greenfield product"]

## Phase 1: MVP

[Insert must-have features for launch - from Step 4]

## Phase 2: Post-Launch

[Insert planned future features - from Step 4, or "To be determined" if they said none yet]
```

#### tech-stack.md

```markdown
# Tech Stack

[Organize the tech stack information into logical sections]

## Frontend

[Frontend technologies, or "N/A" if not applicable]

## Backend

[Backend technologies, or "N/A" if not applicable]

## Database

[Database choice, or "N/A" if not applicable]

## Other

[Other tools, hosting, services - or omit this section if nothing mentioned]
```

#### architecture.md

```markdown
# Architecture

## Components

[Major components and their responsibilities - from Step 6; bullets]

## Data Flow

[How components talk - requests, queues, events, shared data]

## Environments

[Dev/staging/prod setup, deploy targets - or "TBD"]

## Gotchas

[Unusual things an agent must know before changing code - from Step 6, or "None known"]
```

#### dependencies.md

```markdown
# Dependencies

## Internal

| Service | Provided by | Used for |
|---|---|---|
| [service] | [product/repo] | [purpose] |

## External

| Service | Purpose | Auth method | Docs |
|---|---|---|---|
| [service] | [purpose] | [API key / OAuth / TBD] | [link or TBD] |
```

If a section has no entries, keep the heading with "(none)".

### Step 9: Update the Ecosystem Registry

If `softwareos/ecosystem/ecosystem.md` is accessible (locally, or via `customer_root` and that path exists on disk):

1. Find this product's row in the `## Product Registry` table
2. Set its Status to `documented` and its Product docs path to this repo's `softwareos/products/<product-slug>/`
3. If the product isn't listed, append a row

If `customer_root` is set but the hub repo isn't on disk, skip the update and note it in the Step 10 summary.

If there is no ecosystem.md anywhere, skip silently.

### Step 10: Confirm Completion

After creating all files, output to user:

```
✓ Product documentation created:

  softwareos/products/<product-slug>/mission.md
  softwareos/products/<product-slug>/roadmap.md
  softwareos/products/<product-slug>/tech-stack.md
  softwareos/products/<product-slug>/architecture.md
  softwareos/products/<product-slug>/dependencies.md

✓ Ecosystem registry: [product] marked as documented
  [or: ⚠ Hub repo not on disk — update the Product Registry in <customer_root> manually]

Review these files to ensure they accurately capture your product vision.
You can edit them directly or run /plan-product again to update.
```

## Tips

- If the user provides very brief answers, that's fine — the docs can be expanded later
- If they want to skip a section, create the file with a placeholder like "To be defined"
- For existing codebases, the code-explorer draft (Step 6) is usually faster and more accurate than describing architecture from memory — offer it proactively
- The `/plan-epic` and `/shape-spec` commands read these files when planning work, so having them populated helps with context — architecture.md and dependencies.md in particular keep agents from breaking things they didn't know existed
