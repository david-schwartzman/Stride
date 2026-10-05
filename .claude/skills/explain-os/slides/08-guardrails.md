---
id: guardrails
title: Standards, skills, agents, hooks
tracks: [techlead, new-project, pm]
ground: standards
---

Around the planning hierarchy sit four kinds of reusable machinery:

**Standards** — `softwareos/standards/`. The rules code gets checked against.
`/discover-standards` extracts them from real code, `/inject-standards` pulls
the relevant ones into context, `/index-standards` rebuilds the index. Push the
good ones back to the house profile: `sync-to-profile.sh --profile moveo`.

**Skills** — procedures you repeat the same way every time:
`testing` · `qa` · `audit-log` · `pr` · `process-meeting` · `explain-os` ·
`skill-creator`

**Agents** — focused sub-agents the commands dispatch:
`planner` · `code-explorer` · `code-reviewer` · `security-reviewer` ·
`tdd-guide` · `build-error-resolver` · `curator` · `os-explainer`

**Hooks** — run automatically, no one has to remember them:
`guard-git` (no `--no-verify`, no force-push or commits on the default branch) ·
`protect-config` (don't edit lint/CI config to make checks pass) ·
`secret-scan` (staged diff) · `context-banner` (session-start context)

> **Standard = a rule you check against. Skill = a procedure you repeat.**
> Keep doing something by hand and `/curate` will notice and offer to codify it.
