---
id: dev-loop
title: The dev loop
tracks: [techlead]
ground: branch
---

From "we're doing this next" to a merged PR:

```
1  /shape-spec        (plan mode) pick the epic → spec.md + tasks.md
2  branch             feat/<epic-slug>/<spec-slug>
3  testing skill      TDD per task; tick tasks.md as you go
4  /verify            build · lint · typecheck · tests
5  /code-review       standards-aware review of the branch diff
6  qa skill           acceptance criteria → qa-report.md
7  pr skill           preflight, open the PR, write the URL into tasks.md
```

**The branch name is load-bearing.** `feat/<epic-slug>/<spec-slug>` is the key
that maps your working branch back to its spec. The session banner,
`/project-status`, `qa`, `audit-log`, and `pr` all read it. An off-convention
branch doesn't break anything loudly — the tools just go blind.

Parallel work on one spec: `feat/<epic>/<spec>--t<id>`, split by task.

**`tasks.md` states:** `[ ]` open · `[x]` done · `[~]` in progress · `[-]`
cancelled. IDs `T<n>` / `T<n>.<m>` are **append-only** — never renumbered, so
a task ID in a commit or a PR still means the same thing a year later.
`/project-status` parses this exact format, so don't freestyle it.
