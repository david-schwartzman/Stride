# SoftwareOS

This directory is the project's planning root, managed by SoftwareOS commands.
Core principle: **the spec is the single source of truth.** Bugs and change
requests update the owning spec in place (Changelog audit trail) — there is no
bugs folder.

## Tree

```
softwareos/
├── config.yml        # customer, customer_root (optional), default_branch, mode
├── customer/         # business goals, team, tech stack, repo index
├── ecosystem/        # ecosystem.md + products.index.yml (product registry)
├── meetings/         # cross-product meeting write-ups (process-meeting skill)
├── products/
│   └── <product>/    # mission, roadmap, tech-stack, architecture, dependencies, repos
│       ├── epics.index.yml
│       ├── meetings/ # YYYY-MM-DD-<slug>.md — upstream of epics, no index
│       └── epics/<epic>/
│           ├── epic.md
│           ├── specs.index.yml
│           └── specs/<YYYY-MM-DD-spec>/   # spec.md, tasks.md, standards.md, references.md, qa-report.md, visuals/
└── standards/        # coding standards (index.yml + <area>/*.md)
```

## Which command owns what

| Command | Owns |
|---|---|
| /join-project | discovers customer/ + ecosystem/ + products/ + epics from an existing codebase; asks for `mode` |
| /plan-customer | customer/ + config.yml |
| /plan-ecosystem | ecosystem/ |
| /plan-product | products/<product>/ |
| /plan-epic | products/<product>/epics/<epic>/ |
| /shape-spec | products/<product>/epics/<epic>/specs/<spec>/ |
| /hotfix | fixes a defect + edits the owning spec.md Changelog (no bug doc) |
| /spec-changes | edits spec.md (+ tasks.md) in place |
| /refresh-indexes | rebuilds every index.yml from the filesystem |
| /curate | proposes standards/skills from recurring patterns |
| /go-production | audits readiness, then flips `mode` to production (`--revert` to go back) |
| /discover-standards, /index-standards | standards/ |

## Project mode

`config.yml` carries `mode: setup | production`.

- **setup** — lightweight. Specs may opt out of automated tests; /verify and QA report
  gaps without failing on them.
- **production** — every generated `tasks.md` demands unit tests, security review, and
  full QA; /verify, the qa skill, and the pr preflight fail on missing verification.

The mode is always asked, never guessed — `/join-project` and `/plan-customer` ask when
onboarding. Run `/go-production` to transition an existing project; it audits every spec
first and records any waivers in `production-readiness.md`. A config with no `mode:` key
is treated as `setup`.

## Getting started

- **New here?** Run `/explain-os` — a ~10 minute walkthrough of the hierarchy and
  which command to use when, grounded in this project's actual docs. Start every
  new techlead there.
- **Existing codebase:** run `/join-project` — it discovers the whole hierarchy.
- **New:** /plan-customer → /plan-ecosystem (optional) → /plan-product → /plan-epic → /shape-spec.
- **Coming out of a meeting:** the process-meeting skill writes the understanding into
  `meetings/` and hands /plan-epic or /shape-spec an ordered list of what to build.

Status anytime: /project-status. Skills: testing, qa, audit-log, pr, process-meeting,
explain-os, skill-creator.
