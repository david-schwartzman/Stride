---
name: process-meeting
description: Turns a meeting recording, transcript, or notes doc into a domain-understanding write-up at softwareos/[products/<product>/]meetings/YYYY-MM-DD-<slug>.md — NOT minutes. The output is a comprehension artifact a reader can grasp without watching the recording: a feature map, Mermaid diagrams per workflow, the end-to-end flow, decisions / assumptions / open questions, symmetry gaps, and an ordered "what to build next" mapped to real products and epics so it feeds /plan-epic, /shape-spec, /spec-changes or /hotfix. Spoken and non-English terms are reconciled to canonical codebase names. Use whenever the user shares a recording URL (Fathom, Zoom, Meet, Granola, Otter, a notetaker MCP), a transcript path, pastes a transcript, or says "process the meeting", "write up the meeting", "map this module", "break this meeting into specs", or any close variant. Skip only when editing an existing write-up rather than producing a new one.
---

# Process Meeting

Turn a meeting into **one markdown file** that lets a reader understand the module without watching
the recording, then hand the planning hierarchy a clean list of what to build next. The output is a
*comprehension artifact*, not minutes: it names the functional areas, draws the workflows as Mermaid
diagrams, lays out the end-to-end flow, and ends with the gaps plus an ordered, command-mapped
"what to build next".

A meeting sits **upstream of the planning hierarchy**: this write-up is what `/plan-epic` (candidate
specs) and `/shape-spec` (a single slice) consume. Producing it is not planning — never create epics
or specs from here; propose them and hand off.

This skill is **self-contained** and **project-agnostic**: it derives the project's real vocabulary,
conventions and symmetry rules from the repo itself (`CLAUDE.md`, `softwareos/`, the code) rather
than hardcoding any domain.

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **One question at a time** — wait for each answer
- **Never invent content** — everything in the write-up traces to the transcript, the repo, or is
  labelled `inferred`
- **Write exactly one file** (plus, if asked, the raw transcript) — no epics, specs, or task edits
- **Honest-empty rule** — no section is dropped; empty → `_Nothing in this meeting._`

## Locating SoftwareOS

1. Run `git rev-parse --show-toplevel`; if it succeeds and `<root>/softwareos/` exists, that's the
   SoftwareOS root. If not a git repo, walk up from cwd looking for `softwareos/`.
2. If not found: tell the user this repo isn't onboarded — run `/join-project` (existing codebase),
   `/plan-customer` (new customer), or the installer (`project-install.sh`) first. You may still
   produce the write-up, but say in **Meta** that it couldn't be grounded in project docs and place
   it at `docs/meetings/` instead. Prefer onboarding first.
3. Read `softwareos/config.yml`. If `customer_root` is set, read customer/ecosystem docs from that
   path (if it doesn't exist on disk, say so and continue with local docs).
4. Enumerate from the filesystem, never from caches: products = dirs under `softwareos/products/`;
   epics = dirs under `products/<product>/epics/`; specs = dirs under
   `products/<product>/epics/<epic>/specs/` (also read legacy flat `softwareos/epics/<epic>/specs/`).

## Inputs

1. **A recording URL** from whatever notetaker the team uses (Fathom, Granola, Otter, Zoom, Google
   Meet, monday notetaker, …), or a bare recording/call ID.
2. **A transcript or notes file path** — read it directly, no MCP needed.
3. **A pasted transcript** in the conversation.
4. **Optional speaker map** — e.g. `Speakers: Dana = ops lead; Ron = PM`. Upgrades attribution from
   "the room" to a named speaker (those become `explicit`).
5. **Optional hints** — meeting type, slug, product/epic, "this is about the dispatch board". Honor
   them.

Proceed on your best read; record judgement calls in **Meta**. Ask a clarifying question only if the
meeting's *subject* is genuinely indeterminate, or if no transcript source resolves.

## Output

```
softwareos/products/<product>/meetings/YYYY-MM-DD-<slug>.md    # product-scoped (preferred)
softwareos/meetings/YYYY-MM-DD-<slug>.md                       # cross-product, or no products yet
…/meetings/YYYY-MM-DD-<slug>.transcript.md                     # optional, only on request
```

- **Product scoping:** if the meeting is clearly about one product, write under that product. If it
  spans products (or the tree has no products yet), use the top-level `softwareos/meetings/`. When
  two products are plausible, ask once (AskUserQuestion listing `softwareos/products/*` + "spans
  several / not sure").
- **Never** write into `epics/` or `specs/` — `/refresh-indexes` regenerates those index families
  from the filesystem, and a meeting file there would pollute them. `meetings/` is deliberately
  outside that machinery: no index file, discover with `ls`.
- **Slug** — short, lowercase, hyphenated, durable: `dispatch-board-trip-card`,
  `customer-credit-hold`. Not `weekly-sync-3`.
- **Mermaid diagrams go inline** in fenced ```mermaid blocks — GitHub and the IDE preview render
  them. (If the user wants a rendered view, an Artifact renders mermaid too — offer, don't assume.)

## Process

### Step 1: Acquire the transcript

Pick the first source that resolves:

**A file path or pasted text** → use it directly. Fastest path; skip the MCP entirely.

**A recording URL or ID + a notetaker MCP.** Check what this session actually has before assuming —
`ToolSearch` with keywords like `transcript meeting recording notetaker` — then use that provider's
read tools. Confirm the connection once (an identity/context call) so a failure surfaces as "MCP not
connected", not as an empty write-up. Worked example, Fathom:

```
get_identity()                                      # confirm the MCP is live (once)
get_recording_by_url(url=<the URL>)                 # → recording_id + canonical url
get_meeting_summary(recording_id=<id>)
get_meeting_transcript(recording_id=<id>, url=<canonical url>)
```
Bare numeric ID → try the by-call-id lookup first; on "not found or access denied", retry the same
number as a recording ID. When a URL or ID is already given, **don't** use the provider's discovery
tools (list/search meetings, find person) — they're for finding a recording you don't have.

**A meeting doc** (Google Drive, monday doc, Notion, …) → read it via the corresponding MCP if
connected.

**Nothing resolves** → say which sources you tried, and ask for a path or a paste. Never proceed on
a summary alone without saying so in **Meta**; a summary-only run yields a thinner write-up and the
reader must know that.

Grab the provider's own summary too when it's cheap — useful for cross-checking, never a substitute
for the transcript.

### Step 2: Fix identity

- **Date** — from the recording metadata (fallback: the file's date, or ask) → the `YYYY-MM-DD`
  filename prefix.
- **Type** — `discovery` / `design` / `review` / `standup` / `bug-triage` / `standalone`.
- **Slug** — durable, per the rules above.
- **Attendance** — invited vs actually present, when the provider exposes it.
- **Scope** — one module, or several? If the meeting covers two genuinely unrelated modules, ask
  once: one file with two feature maps, or two files.

### Step 3: Reconcile spoken terms to canonical project names (BEFORE writing)

Speech-to-text garbles exactly the words that matter most: product names, entity names, and any
non-English domain vocabulary (RTL languages, transliterations, and mixed-language speech are the
worst offenders — a term can come back as a different real word). **Cross-check every domain term
against the project** and use the canonical name in the write-up, noting the correction in **Meta**.

```bash
ls softwareos/products/*/ softwareos/products/*/epics/            # the real area names
grep -rniE "<candidate term>" softwareos/products softwareos/standards CLAUDE.md 2>/dev/null | head
grep -rniE "<candidate term>" --include='*.*' -l . 2>/dev/null | head   # the code's own naming
ls softwareos/**/meetings/*.md 2>/dev/null                        # prior meetings' glossaries
```

Rules:
- Canonical codebase/doc name in the prose; the original spoken term in parentheses on first use;
  both in the **Glossary**.
- A term that exists nowhere in the repo is a *finding*, not an error — it's new vocabulary. Mark it
  `new` in the Glossary.
- Never silently "fix" a term into something the repo doesn't use.

This step is load-bearing — it's what turns a garbled transcript into correct domain names, and it's
what makes the write-up greppable alongside the rest of `softwareos/`.

### Step 4: Derive the project's symmetry axes

Most cross-cutting bugs come from a feature shipped for one member of a set and forgotten for its
siblings. The axes are project-specific, so **derive them from the repo** (once per run):

- `CLAUDE.md` — explicit rules ("keep X and Y in parity", "every list screen has a mobile variant")
- `softwareos/standards/index.yml` + the standards files it points at
- `softwareos/products/<product>/architecture.md` and `mission.md` — parallel modules, entity pairs
- The codebase — sibling directories/models with near-identical shapes, N-way variants, per-role or
  per-tenant duplicates, and paired lifecycle entities (draft↔final, request↔fulfilment)

Write the axes down for use in Step 6. If the project genuinely has none, that's an honest empty.

### Step 5: Build the comprehension write-up

Work in this order — it's how you actually understand a module, not section-filling:

1. **Decompose into functional areas** → the Feature map.
2. **Trace the happy path** end-to-end, then each branch → the End-to-end flow, plus a Mermaid
   diagram per distinct workflow. A diagram is required for the core flow and for any branchy
   sub-flow (variant handling, a decision dialog, a status machine). Prefer 2–4 focused diagrams
   over one giant one.
3. **Separate what's settled from what's not** → Decisions & assumptions vs Open questions & gaps.
   Preserve hedges verbatim ("for now", "probably") — never round a hedge up to "decided".
4. **Screen for symmetry** (Step 6) and **map to what to build next** (Step 7).

Every section in the template is required.

### Step 6: Symmetry screen

For each feature discussed, name the sibling(s) along the Step 4 axes that were **not** mentioned,
in **Symmetry implications**. The *silence* about a sibling is the finding — surfacing it here stops
the downstream epic or spec inheriting the gap. Genuinely single-surface feature, or no axes in this
project → `_Nothing in this meeting._`

### Step 7: What to build next

This ordered list is the whole point — it's what turns the meeting into work:

- Map each actionable item to a **real** product and epic enumerated from disk. Don't invent
  areas; if nothing fits, mark the target `new epic` (that's a signal for `/plan-epic`).
- Route each item to the SoftwareOS command that owns it:

  | Situation | Command |
  |---|---|
  | New outcome-level body of work, needs slicing | `/plan-epic` |
  | One shippable slice inside an existing epic | `/shape-spec` |
  | Changes what an existing spec promised | `/spec-changes` |
  | Built behavior contradicts a shipped spec | `/hotfix` |
  | Product-level shift (mission, roadmap, architecture) | `/plan-product` |
  | Recurring convention worth codifying | `/curate` |

- **Order by readiness** and say what each blocked item is blocked on. Ready-now items at the top.

### Step 8: Write, then hand off

Write the single file (create the `meetings/` dir if needed). Then offer the handoff — don't perform
it unasked:

```
Write-up saved: softwareos/products/<product>/meetings/<file>.md

Ready-now items: <n> · Blocked: <m>

Want me to take the next step?
1. /plan-epic for <top item> (needs slicing)
2. /shape-spec for <top item> (one slice, ready now)
3. Nothing — just the write-up
```

When a downstream epic or spec does get created from this meeting, cite the write-up's repo-relative
path in the epic's `tech-plan.md` (Approach) or the spec's `references.md`, so provenance survives
the handoff.

## Write-up template

Level-1 `#` headings exactly as below (so later greps resolve). Every section required.

```markdown
# <Module / feature> — module understanding
**Source:** <provider> <date> "<title>" · <url or path> · Type: <type>
**Scope:** <product> / <epic or "new epic"> · Attendees: <names or "not captured">

# TL;DR
3–5 sentences: what the module is, its core interaction, and the single most important open thing.

# Feature map
Bulleted functional areas, one line each. Follow with a ```mermaid overview graph of how they connect.

# End-to-end flow
Short narrative of the happy path, then a ```mermaid flowchart of it. Add a diagram per distinct
branch/sub-flow (variant types, decision dialogs, status machine) — 2–4 focused diagrams, not one blob.

# Variants & behavior   ← rename to the module's core-logic axis (order types, plan tiers, roles); drop if N/A
Table of the variants and how the UI/flow adapts, plus a ```mermaid branch diagram for the tricky one.

# Decisions & assumptions
**Decisions** (a choice between alternatives): statement · [explicit|inferred|hedged] · rationale.
**Assumptions** (working premises not yet ratified): statement · why it's provisional.
Hedges verbatim.

# Open questions & gaps
Undefined behavior, unmodelled cases, and gaps YOU spotted (e.g. a sibling never walked through).
Each: the question/gap + status [open|blocked|needs-deep-dive] + who could answer it.

# Symmetry implications
Per item, the sibling(s) NOT mentioned, against the axes derived from this project.
`_Nothing in this meeting._` if genuinely single-surface.

# What to build next
Ordered by readiness.
| # | Item | Product / Epic | Command | Ready now / Blocked on |
|---|---|---|---|---|

# Glossary
Term (canonical project name) — meaning. Flag STT corrections and `new` vocabulary.
`_Nothing in this meeting._` if none.

# Meta
Provenance (source + whether transcript or summary-only), STT corrections made, attribution caveats,
type/scope calls, anything a reader should distrust.
```

If the meeting has no feature content at all (a pure standup, a scheduling call), fall back to a
plain narrative write-up with **Decisions**, **Open questions**, **What to build next** and **Meta**
— and say in Meta why the comprehension shape didn't apply. The default is the shape above.

## Extraction discipline

- **Confidence-tag claims** — `explicit` (said), `inferred` (you concluded it, including from
  diarization), `hedged` (keep the hedge verbatim). Unsure → the stricter tag.
- **Speaker = "the room"** unless there's a self-ID or a supplied speaker map. Diarization is
  `inferred`, never `explicit`. Don't invent speakers.
- **Decision vs assumption vs constraint** — a decision chooses between alternatives; an assumption
  is an unratified working premise; "we must use X because X is what we have" is neither (it's
  environment — put it in the flow narrative).
- **Owner from words, not voices** — nobody owned it in the words → `null`, and flag it.
- **Diagrams are content, not decoration** — every branch you draw must trace to something in the
  transcript. If you infer a link to make the diagram whole, label it (`inferred`).
- **Acceptance-criteria language is a bonus, not the job** — capture crisp testable statements when
  the room states them, but `/shape-spec` owns ACs. Don't pre-write a spec here.
- **Sensitive content** — transcripts routinely contain salaries, customer names, credentials talk.
  Never save the raw transcript unless the user asks; when they do, confirm it's going into a
  committed repo, and keep anything sensitive out of the write-up itself.

## Re-run on an existing meeting

If `meetings/<date>-<slug>.md` already exists, ask whether to overwrite, append a revision section,
or write a sibling (`<date>-<slug>-v2.md`). Default if unanswered: the non-destructive sibling.

## Tips

- **Comprehension beats coverage** — a reader who understands the module is the goal; an exhaustive
  list of everything said is not.
- **Prior meetings are context** — `ls softwareos/**/meetings/` first; reuse the established glossary
  and don't re-litigate decisions an earlier write-up already recorded.
- **Summary-only is a degraded run** — the diagrams and branch logic come from the transcript. Say so
  in Meta rather than quietly producing a thin file.
- **The write-up is not the source of truth** — `spec.md` is. This file is the upstream record of how
  the team came to understand the domain; once specs exist, they win.
