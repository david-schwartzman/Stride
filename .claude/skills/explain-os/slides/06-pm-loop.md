---
id: pm-loop
title: The PM loop
tracks: [techlead, pm]
ground: none
---

The other half of the cycle — where specs come from in the first place:

```
process-meeting     recording / transcript → a module-understanding write-up
  skill             under meetings/, ending in an ordered "what to build next"
     ▼
/plan-epic          open the next epic — product brief (PM) + tech plan (Tech)
     ▼
/shape-spec         shape the specs inside it
     ▼
/project-status     read-only: tasks, branches, devs, PRs, stale/drift flags
     ▼
/spec-changes       reality moved → change the agreed spec, with an audit trail
```

**Role gating.** Epic and spec sections are owned by **PM**, **Tech**, or
**Both**. A section nobody has filled doesn't disappear — it stays visible as:

```
_Pending — rerun /shape-spec as <role> to fill._
```

Gaps are explicit, never silent. That marker is the handoff: it tells the other
role exactly what's waiting on them.

**audit-log** skill answers "what happened to this spec?" — changelog rows,
hotfixes, doc edits, and code commits merged into one timeline.
