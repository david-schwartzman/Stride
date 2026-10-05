---
id: which-command
title: Which command, when
tracks: [techlead, new-project, pm, quick]
ground: gaps
---

Start from what you want to do, not from the command list:

| I want to… | Run |
|---|---|
| Onboard an existing codebase into SoftwareOS | `/join-project` |
| Set up a brand-new customer | `/plan-customer` |
| Map several products + shared services | `/plan-ecosystem` |
| Define a product — mission, architecture, deps | `/plan-product` |
| Open the next feature surface | `/plan-epic` |
| Turn "we should build X" into a spec + tasks | `/shape-spec` |
| Fix a bug | `/hotfix` |
| Change a spec that's already agreed | `/spec-changes` |
| See where everything stands | `/project-status` |
| Rebuild `index.yml` files after manual edits | `/refresh-indexes` |
| Check the build before opening a PR | `/verify` |
| Review the branch against our standards | `/code-review` |
| Capture conventions from real code | `/discover-standards` |
| Codify a pattern we keep repeating | `/curate` |
| Pull SoftwareOS updates into this repo | `/update-os` |
| Hear this explanation again | `/explain-os` |

**Rule of thumb:** if it changes *what we're building*, it's a `/plan-*` or
`/shape-spec`. If it changes *code*, it's a loop command (`/verify`,
`/code-review`, `/hotfix`) or a skill.

**Never** hand-write a doc that a command owns. It won't be indexed, the other
commands won't find it, and the next `/refresh-indexes` will disagree with you.
