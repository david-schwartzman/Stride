---
name: explain-os
description: Walk through what SoftwareOS is — the customer → ecosystem → product → epic → spec hierarchy and which command to use when — as a presentation grounded in this project
argument-hint: "[techlead | new-project | pm | quick | <slide-id> | a question in words]"
---

# /explain-os

The onboarding story for **every new techlead and every new project**. Presents
the built-in SoftwareOS deck one slide at a time, grounded in *this* project's
real customer, products, epics, and specs — then hands over the one command to
run next.

Also answers a single question directly: `/explain-os "how do I fix a bug?"`.

**Read-only.** Nothing is written, no git state is touched.

## Run it

Invoke the **`explain-os`** skill (Skill tool), passing `$ARGUMENTS` through
unchanged. The skill owns the deck, the chrome, and the navigation; this command
is the front door.

The skill routes the argument:

| Argument | Result |
|---|---|
| *(none)* | asks who it's for, then presents that track |
| `techlead` | full story, ~10 slides — the default for a new techlead |
| `new-project` | what it is + how to stand SoftwareOS up in a repo |
| `pm` | the planning levels and the PM loop |
| `quick` | the essentials in ~6 slides |
| a slide id (e.g. `hierarchy`) | opens the deck at that slide |
| a question in words | answers it, skips the deck |

Navigation, once it's running: `⏎` next · `b` back · `<id>` jump · `?` ask ·
`q` quit to the closing slide.

## What it covers

| Slide | Answers |
|---|---|
| `title` | what SoftwareOS is, in four lines |
| `why` | why docs-beside-the-work rot, and what replaces them |
| `hierarchy` | customer → ecosystem → product → epic → spec, and what each level answers |
| `on-disk` | the `softwareos/` tree — where every doc lives |
| `which-command` | **the routing table** — "I want to…" → the command |
| `dev-loop` | shape-spec → branch → testing → verify → code-review → qa → pr |
| `pm-loop` | process-meeting → plan-epic → project-status → spec-changes, and role gating |
| `spec-stays-true` | why bugs and changes edit the owning spec, and there's no bugs folder |
| `guardrails` | standards, skills, agents, hooks |
| `next-*` | your first hour — as a techlead, a new project, or a PM |

The deck itself is markdown under `.claude/skills/explain-os/slides/` — readable
standalone, and the place to edit if the story changes.

## Grounding

Before presenting, the skill dispatches the **`os-explainer`** agent to read the
project's `softwareos/` tree and return the real names — so the hierarchy slide
shows *your* products, the dev-loop slide shows *your* branch and its open task
count, and the closing slide names *your* next command.

It also returns **gaps**: which commands haven't run here yet (no `ecosystem/`,
a roadmap still on its pending stub, standards never discovered, indexes drifted
from the filesystem). That's usually the most useful minute of the whole thing.

If the repo has no `softwareos/` yet, that's not an error — the presentation
defaults to the `new-project` track and ends on `/join-project`.

## Tips

- **Run it on day one, in the project repo** — grounding is where the value is;
  the deck ungrounded is just a README.
- **Ask mid-deck.** `?` or a plain question pauses, answers, and puts you back
  where you were.
- **Pair with `/project-status`.** `/explain-os` teaches the map;
  `/project-status` shows where everyone currently is on it.
- **When the framework changes, edit the slide, not this file.** Adding a slide
  is one file in `slides/` with `id` / `title` / `tracks` / `ground` frontmatter.
