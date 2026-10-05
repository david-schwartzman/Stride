---
id: next-techlead
title: Your first hour
tracks: [techlead, quick]
ground: onboarding
---

You've joined a project that already runs SoftwareOS. In order:

1. **`softwareos/customer/overview.md`** — who we build for, and what they want.
2. **`softwareos/products/<yours>/mission.md`** then **`architecture.md`** —
   what your product is and how it's put together.
3. **`/project-status`** — what's in flight, who's on what, what's stale.
4. **Your epic:** `products/<p>/epics/<e>/epic.md` + `tech-plan.md`. The tech
   plan is the one written for you.
5. **Your first change:** `/shape-spec` → branch → `testing` → `/verify` →
   `/code-review` → `qa` → `pr`.

**Three things that will bite you if nobody says them out loud:**

- **Branch on convention or the tools go blind** —
  `feat/<epic-slug>/<spec-slug>`, always.
- **Don't hand-write docs a command owns.** If you already did, run
  `/refresh-indexes` to put the indexes back in sync.
- **A bug is never a new spec.** `/hotfix`, and it lands on the owning spec's
  Changelog.

Stuck on which command? Run `/explain-os "how do I …"` and ask in words.
