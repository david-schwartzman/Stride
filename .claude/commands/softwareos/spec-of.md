---
name: spec-of
description: Reverse lookup — given a route, page, file, or module, report which spec owns it
argument-hint: "[route, path, or glob — e.g. /checkout/guest or src/lib/pricing.ts]"
---

# /spec-of

Answer "which spec owns this?" for a route, page, file, or module. This is the reverse of `/shape-spec`'s Step 4 (Pre-Flight Integrity Check): that step asks *"here's a new spec — does anything already own this area?"*, this one asks *"here's an area — which spec owns it?"*.

Read-only. Reads indexes and spec files, writes nothing, and never creates or modifies a spec. Output goes to chat.

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if it succeeds and `<root>/softwareos/` exists, that's the SoftwareOS root. If not a git repo, walk up from cwd looking for `softwareos/`.
2. If not found: tell the user this repo isn't onboarded — run `/join-project` (existing codebase) or the installer (`project-install.sh`) first. Stop.
3. Enumerate from the filesystem, never from memory: `softwareos/products/*/epics/*/specs.index.yml`, plus legacy flat `softwareos/epics/*/specs.index.yml` if present.

## The map it reads

Every spec declares what it owns in its `spec.md` header:

```
> Covers: /checkout, /checkout/guest, src/features/checkout/**
```

`/refresh-indexes` mirrors that into each epic's `specs.index.yml` as a `covers:` list, which is always present (`covers: []` when empty). This command is a **pure reader** over that field — it adds no new data and writes nothing back.

If every `covers:` in the tree is empty, say so plainly and point at the cause: specs shaped before this field existed have nothing to match on. Suggest `/refresh-indexes` (to pick up `> Covers:` lines added by hand) and note that specs shaped from now on fill it during `/shape-spec` Step 4.

## The match rules

**This is the canonical ranked match rule set used to compare a query against a spec's `covers` values.** Both directions read from here — `/spec-of`'s Step 2 (reverse: *which spec owns this area?*) and `/shape-spec`'s Step 4c (forward: *does anything already own this candidate?*). Defining them once is the only way the two directions can be guaranteed to agree; if they drift, `/shape-spec` reports "no overlap" while `/spec-of` reports two owners for the same query, which is a silent correctness bug.

Compare each candidate `C` (or query `Q` when read from `/spec-of`) against each existing `covers` value `V`, strongest rule first:

1. **Exact** — `C == V` → strong.
2. **Route prefix** — both start with `/` and one is a prefix of the other at a `/` boundary (`/checkout` matches `/checkout/guest`; `/checkoutx` does **not** match `/checkout`) → strong.
3. **Glob** — either side contains `*` or `**`; glob-test the other against it (minimatch semantics) → strong.
4. **Path segment** — neither of the above, but one contains the other and the shared portion spans a full `/`-delimited segment → strong.
5. **Fallback body scan** — grep the candidate/query as a literal string against `spec.md` in every spec folder in scope. This catches legacy specs written before `> Covers:` existed → **weak**.

**Ordering:** run rules 1–4 first. Run rule 5 only when none of 1–4 produced a strong match — a body-text mention is evidence, not ownership.

**Ranking within results:** strong before weak; within a tier, the more specific `covers` value first (longer match, fewer wildcards). A spec claiming `/checkout/guest` outranks one claiming `/checkout` for the query `/checkout/guest`.

**Scope** (which `specs.index.yml` files to read) is set by the caller — `/spec-of` reads cross-tree; `/shape-spec` 4c reads epic or cross based on the 4b question.

## Process

### Step 1: Resolve the query

Take the query from the argument. If none was given, use AskUserQuestion:

```
What area do you want the owning spec for?

Examples:
- /checkout/guest          (a route or page)
- src/lib/pricing.ts       (a file or module)
- src/features/auth/**     (a glob)

(Paste one)
```

Normalize the query: trim it, strip a leading `./`, and strip any trailing `/` (except a bare `/`). Keep case as written.

**Convenience:** if the query resolves to an existing file on disk, also derive its repo-relative path and match on both forms. Passing an absolute path or a path relative to cwd should work without the user thinking about it.

### Step 2: Match against the map

Read every `specs.index.yml` in scope (per Step 1's Locating rules — cross-tree here) and apply [the match rules](#the-match-rules) with `Q` as the query. Rank the results per the ranking rules in the same section.

### Step 3: Report

Print to chat — no files, no follow-up questions.

**Single owner:**

```
/checkout/guest
└── rental / checkout-booking-flow / 2026-07-30-guest-checkout   [strong: /checkout/guest]
    status: in-progress · branch: feat/checkout-booking-flow/guest-checkout
    spec: softwareos/products/rental/epics/checkout-booking-flow/specs/2026-07-30-guest-checkout/spec.md
```

**Multiple owners** — list all, ranked, and flag it. Two strong owners for one area is a real finding: it means coverage was split without `/shape-spec` Step 4 catching it (a spec shaped before this check existed, or a `> Covers:` line edited by hand).

```
src/lib/pricing.ts
├── jobs / pricing / 2026-05-01-price-engine        [strong: src/lib/pricing.ts]
└── rental / checkout-booking-flow / 2026-07-30-…   [strong: src/lib/**]

⚠ 2 specs claim this area. If that's unintended, reconcile the `> Covers:` lines
  (and rerun /refresh-indexes), or record the split with /spec-changes.
```

**Weak match only:**

```
/admin/reports
└── rental / admin-tools / 2026-04-02-report-builder   [weak: found in spec.md body]

No spec declares this in its `> Covers:` line — this is a body-text match.
```

**No match:**

```
/admin/reports — no owning spec found.

Searched <n> specs across <m> epics (<k> have a non-empty `covers:`).
This area may be unspecified, or an existing spec's `> Covers:` line may be
incomplete — /shape-spec will claim it when you shape work here.
```

Always close with the count of what was searched, so an empty result is distinguishable from an empty map.

## Tips

- **It only knows what specs declare** — an unclaimed area means no spec listed it, not that no spec touches it. Treat a miss as a prompt to fill in a `> Covers:` line.
- **Useful before `/hotfix`** — a bug report is usually a URL or a stack trace, not a spec name; resolve the area to its spec first, then hotfix the right `spec.md`.
- **Useful during review** — map the changed files in a diff to their owning specs to pull the right Acceptance Criteria into the review.
- **Two owners is a signal** — reconcile it rather than living with it; overlapping coverage is exactly what `/shape-spec` Step 4 exists to prevent.
