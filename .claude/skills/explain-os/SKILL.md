---
name: explain-os
description: Presents the built-in SoftwareOS onboarding deck — what SoftwareOS is, the customer → ecosystem → product → epic → spec hierarchy, and which command to use when — grounded in this project's real docs. Use for /explain-os, when someone new joins a project, or when asked what SoftwareOS is, how the levels relate, or which command to run for a given situation.
---

# Explain SoftwareOS

Walk a human through SoftwareOS using the **built-in presentation** in `slides/`,
grounded in **this project's real docs** so the examples are their products and
epics, not invented ones. Read-only: this skill never writes a file.

This is the onboarding story for every new techlead and every new project.

## Important Guidelines

- **Present, don't lecture.** One slide per turn, then stop and wait. Never dump
  the whole deck in one message — the pause is what makes it a presentation.
- **Render slide bodies close to verbatim.** They're the built-in deck, written
  to be read as-is. Grounding gets *appended*, not woven in; don't rewrite,
  summarize, or "improve" a slide.
- **Ground in reality or say nothing.** Only state project facts the
  `os-explainer` agent actually returned. Never invent a product or epic name.
- **Use AskUserQuestion** for the track choice — one question, then go.
- **Read-only.** No files written, no git state touched.

## Locating the deck and the project

1. **Slides** live next to this file, in `slides/`. In an installed project
   that's `.claude/skills/explain-os/slides/`; in the SoftwareOS base repo it's
   `skills/explain-os/slides/`. If neither resolves, glob
   `**/explain-os/slides/*.md`. If there are still no slides, say so and stop —
   don't improvise a deck from memory.
2. **SoftwareOS root** — run `git rev-parse --show-toplevel`; if
   `<root>/softwareos/` exists that's the root, else walk up from cwd. **Not
   finding one is fine and informative** — it means the repo isn't onboarded
   yet, which is exactly what the `new-project` track is for.
3. Read `softwareos/config.yml` if present (`customer`, `customer_root`,
   `default_branch`).

Each slide file is frontmatter + body:

| Key | Meaning |
|---|---|
| `id` | stable slide id, used for `jump` and for track lists |
| `title` | rendered in the slide header |
| `tracks` | which tracks include this slide |
| `ground` | which grounding facts to append (`none` = append nothing) |

## Process

### Step 1: Pick the track

If the user passed an argument, skip the question and route on it:

- **a question in words** ("how do I fix a bug?", "what's an epic?") → skip the
  deck entirely, go to **Q&A mode** (Step 5).
- **a track name** (`techlead`, `new-project`, `pm`, `quick`) → use it.
- **a slide id** (e.g. `hierarchy`) → open the deck at that slide, `techlead` track.

Otherwise ask once with AskUserQuestion — "Who am I explaining this to?":

| Option | Track | Slides |
|---|---|---|
| New techlead on this project *(recommended)* | `techlead` | the full story, ~10 slides |
| Setting up a new project | `new-project` | what it is + how to stand it up |
| PM / product | `pm` | the planning levels and the PM loop |
| Quick tour | `quick` | the essentials in ~6 slides |

If no `softwareos/` was found, make **`new-project`** the recommended option
instead — this repo isn't onboarded yet.

Build the slide list by filtering the deck on `tracks` and sorting by filename.

**The closing slide** is the `next-*` slide in the track. The `quick` track
carries `next-techlead`; swap it for `next-project` if the repo has no
`softwareos/` yet, so the closer matches the situation the listener is in.

### Step 2: Ground it in this project

If a `softwareos/` root exists, dispatch the **`os-explainer`** agent (Agent
tool) in `grounding` mode with the root path. It returns a grounding pack:
customer, products, epic and spec counts, the current branch's epic/spec
mapping, standards areas, and gaps.

Hold the pack in memory for the whole presentation. If the agent returns
nothing usable, present the deck ungrounded — the slides stand on their own.

### Step 3: Render the deck

Render **one slide per message**, in this chrome:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SoftwareOS · <n>/<total>                              <slide title>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<slide body, verbatim>

<grounding block, if this slide declares one>
───────────────────────────────────────────────────────────────────────
 ⏎ next · b back · <id> jump · ? ask · q quit
```

`<n>/<total>` are positions **within the chosen track**, not the file numbers —
that's why the slide files don't carry their own numbering.

**The grounding block** is appended under the body as a short indented note,
never more than ~4 lines:

```
   In this project — customer: frisbee · 3 products (rental, cms, chat-ai)
   · 11 epics · 34 specs. You're on feat/checkout/guest-payment → epic
   `checkout`, spec `2026-07-02-guest-payment` (4 of 9 tasks open).
```

What each slide's `ground` key asks for:

| `ground` | Append |
|---|---|
| `customer` | customer name, product count, whether this is a hub or a spoke repo |
| `products` | real product names and their epic counts — the hierarchy made concrete |
| `epics` | 2–3 real epic slugs, and one real spec folder name |
| `tree` | which parts of the tree actually exist here, and which are still empty |
| `branch` | current branch → its epic/spec, and open task count |
| `standards` | standards areas present, and how many rules |
| `gaps` | commands not yet run here (e.g. "no ecosystem/ — `/plan-ecosystem` hasn't run") |
| `onboarding` | the concrete first step **for this repo**, with real paths |
| `none` | nothing — the slide is universal |

If a fact isn't in the pack, **omit that part silently**. Never write "unknown"
or a placeholder into a slide.

### Step 4: Navigate

After each slide, stop and wait. Handle whatever comes back:

| Input | Do |
|---|---|
| empty / `n` / "next" / "go on" | next slide |
| `b` / "back" | previous slide |
| a slide `id` or a number | jump there |
| `?` or any question | answer it (Step 5), then **re-offer the same slide's next** |
| `q` / "stop" / "that's enough" | jump to the track's closing slide, then finish |

A question mid-deck doesn't end the deck. Answer, then say where you were:
`— back to <n>/<total>. ⏎ to continue.`

After the closing slide, print the handoff and stop:

```
That's SoftwareOS. Your next command: <the one thing to run now>
Full reference: softwareos/README.md · re-run anytime: /explain-os
```

Pick that one command from the track and the grounding pack — `/join-project`
for an un-onboarded repo, `/project-status` for a techlead joining live work,
`/plan-epic` for a PM with a meeting write-up waiting.

### Step 5: Q&A mode

For any question — asked mid-deck, or as the command's argument — answer from
the deck plus the real docs, not from memory of Claude Code in general.

- Answer in **2–6 lines**, and always end with the **command to run**.
- If the answer is a slide, say which and offer it: "that's slide `hierarchy` —
  want it?"
- If the question is about *this project* (which epic, which standard, what's in
  flight) and the answer isn't in the grounding pack, dispatch `os-explainer` in
  `question` mode rather than guessing.
- If SoftwareOS genuinely doesn't cover it, say so plainly and name the closest
  thing it does cover.

## Tips

- **The deck is the content, you're the presenter.** If you find yourself
  writing new explanation instead of rendering a slide, either the deck needs a
  slide (say so) or you're off-script.
- **Grounding is the whole value.** "products/rental/epics/checkout" lands
  where "products/<product>/epics/<epic>" doesn't. Spend the agent call.
- **Un-onboarded repos are a feature.** Don't apologize for the missing
  `softwareos/` — present `new-project` and end on `/join-project`.
- **Keep it under ten minutes.** If someone wants depth, point them at the
  owning command's file in `.claude/commands/softwareos/` — each one documents
  itself.
- **Adding a slide** — drop a file in `slides/`, give it `id`/`title`/`tracks`/
  `ground`, name it to sort into place. Nothing else needs to change.
