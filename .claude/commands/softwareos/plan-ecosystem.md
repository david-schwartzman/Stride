---
description: Map the customer's products and shared services into softwareos/ecosystem/ecosystem.md (multi-product customers)
---

# Plan Ecosystem

Map how a customer's products and shared services fit together. Creates a single file, `softwareos/ecosystem/ecosystem.md`: an ASCII map, a dependency table, and the Product Registry that `/plan-product` builds on. Optional — only useful when the customer has more than one product.

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if it succeeds and `<root>/softwareos/` exists, that's the SoftwareOS root. If not a git repo, walk up from cwd looking for `softwareos/`.
2. If not found: tell the user this repo isn't onboarded — run `/plan-customer` (new customer) or the installer (`project-install.sh`) first. Stop.
3. Read `softwareos/config.yml`. If `customer_root` is set, read customer/ecosystem docs from that path instead of locally (if the path doesn't exist on disk, say so and continue with local stubs).
4. Enumerate from the filesystem, never from caches: products = dirs under `softwareos/products/`; epics = dirs under `products/<product>/epics/`; specs = dirs under `products/<product>/epics/<epic>/specs/`.

**Write target:** ecosystem docs live in the hub repo. If `customer_root` is set and exists on disk, write to `<customer_root>/softwareos/ecosystem/ecosystem.md` and tell the user. If `customer_root` is set but not on disk, say so and write locally, noting the file should move to the hub.

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **One question at a time** — wait for each answer
- **Offer suggestions** — prefill from existing docs; the user confirms, adjusts, or corrects
- **Never invent facts** — anything unknown is "TBD"

## Process

### Step 1: Require Customer Docs

Read `customer/overview.md` and `customer/repos.md` (locally or via `customer_root`).

**If customer docs are missing** (no `customer/`, or only a stub README with no hub on disk), use AskUserQuestion:

```
No customer documentation found. /plan-ecosystem builds on it — especially the repo list.

1. Run /plan-customer first (recommended)
2. Continue anyway (I'll gather everything manually)
3. Cancel

(Choose 1, 2, or 3)
```

If option 1 or 3, stop here.

**Single-product check:** if repos.md lists exactly one repo/product, use AskUserQuestion:

```
This looks like a single-product customer (<repo>). An ecosystem map isn't needed — /plan-product covers everything.

1. Agree — skip /plan-ecosystem
2. There are more products or shared services than the docs show — continue

(Choose 1 or 2)
```

If option 1, stop here.

### Step 2: Check for Existing Map

Check if `ecosystem/ecosystem.md` exists at the write target.

**If it exists**, summarize it (N products, M shared services) and use AskUserQuestion:

```
I found an existing ecosystem map: <N> products, <M> shared services.

Would you like to:
1. Start fresh (replace)
2. Update (add or edit products, services, relationships)
3. Cancel

(Choose 1, 2, or 3)
```

If option 2, ask what changed and only gather info for that. New products **append** rows to the Product Registry; never drop or downgrade a `documented` row without explicit confirmation.
If option 3, stop here.

### Step 3: Identify Products

Prefill candidates from the Product column of `customer/repos.md`. Use AskUserQuestion:

```
From repos.md, these look like the products:

1. <product> — <repo>
2. <product> — <repo>

Correct? Add, remove, or rename as needed — and give me a one-liner on what each does.
```

If repos.md is unavailable, ask directly: "List the customer's products: name, repo (if any), one line on what each does."

### Step 4: Identify Shared Services

Use AskUserQuestion:

```
What's shared across products? (CMS, auth, internal APIs, design system, data pipelines…)

For each: name, what it provides, where it lives (repo or external service).

(Say "none" if products are fully independent)
```

### Step 5: Map Relationships

For each product, one question. Use AskUserQuestion:

```
What does <product> consume or depend on?

(Shared services, other products, key external APIs — and how: REST, SDK, events, direct DB…)
```

If a circular dependency appears (e.g. two products each depending on the other), document both directions and flag with ⚠ in the Notes column. Don't block or try to resolve it.

### Step 6: Generate & Confirm

Build ecosystem.md from the template below. Show the full draft and use AskUserQuestion:

```
Here's the ecosystem map draft:

[full ecosystem.md content]

Save it? (approve / adjust: <what to change> / cancel)
```

On approval, create `softwareos/ecosystem/` at the write target and save. Then output:

```
✓ Ecosystem map created: softwareos/ecosystem/ecosystem.md

  Products: <N> · Shared services: <M> · Relationships: <K>

Next: run /plan-product in each product repo — it flips that product's
Registry row from `planned` to `documented`.
```

## ecosystem.md Content

````markdown
# <Customer> Ecosystem

> Customer: ../customer/overview.md
> Updated: YYYY-MM-DD

## Map

```
<customer>
├── products
│   ├── shop — customer storefront (repo: acme-shop)
│   └── admin — back-office console (repo: acme-admin)
└── shared services
    ├── auth-service — SSO + tokens (repo: acme-auth) · used by: shop, admin
    └── cms — marketing content (external: Contentful) · used by: shop
```

## Relationships

| Consumer | Depends on | Via | Notes |
|---|---|---|---|
| shop | auth-service | REST + JWT | |
| shop | cms | Contentful SDK | read-only |
| admin | auth-service | REST + JWT | |

## Product Registry

| Product | Repo | Product docs path | Status |
|---|---|---|---|
| shop | acme-shop | softwareos/products/<slug>/ | planned |
| admin | acme-admin | softwareos/products/<slug>/ | planned |
````

Status values: `planned` (no product docs yet) | `documented` (/plan-product completed). The registry is the handoff contract — `/plan-product` flips its product's row to `documented` when it finishes.

## Tips

- **Single product? Skip this.** /plan-product alone covers single-product customers.
- **Rerun when a product is added** — update mode appends a registry row and extends the map; nothing else needs regathering.
- **The map shows shape; the table shows truth** — keep `used by:` in the Map consistent with the Relationships table.
- **Circular deps are facts, not failures** — record and flag them; fixing the architecture is an epic, not a docs problem.
- **"TBD" beats a guess** — unknown repos, auth methods, or owners stay TBD until someone confirms.
