---
id: on-disk
title: Where it lives
tracks: [techlead, new-project, pm]
ground: tree
---

Everything is plain markdown under `softwareos/`, committed with the code:

```
softwareos/
├── config.yml                 # customer, customer_root (optional), default_branch
├── customer/                  # business goals, team, tech stack, repo index
├── ecosystem/                 # ecosystem.md + products.index.yml (registry)
├── meetings/                  # cross-product meeting write-ups
├── products/<product>/
│   ├── mission.md  roadmap.md  tech-stack.md  architecture.md
│   ├── dependencies.md  repos.md  epics.index.yml
│   ├── meetings/              # upstream of epics
│   └── epics/<epic>/          # slug only, no date — used in branch names
│       ├── epic.md  product-brief.md  tech-plan.md
│       ├── specs.index.yml
│       └── specs/YYYY-MM-DD-<spec>/
│           ├── spec.md        ← the single source of truth
│           └── tasks.md  standards.md  references.md  qa-report.md  visuals/
└── standards/                 # index.yml + <area>/*.md
```

No database, no SaaS, no export step. If you can read the repo, you can read
the plan — and so can every agent.

- **`index.yml` files are generated**, never hand-written. `/refresh-indexes`
  rebuilds them all from the filesystem when things drift.
- **Multi-repo customers:** one hub repo holds `customer/` + `ecosystem/`; the
  others point at it with `customer_root:` in `softwareos/config.yml`.
