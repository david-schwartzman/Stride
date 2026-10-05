---
id: hierarchy
title: The planning hierarchy
tracks: [techlead, new-project, pm, quick]
ground: products, epics
---

```
  customer     Who we build for — business goals, team, stack, repo index
     │         one-time · PM · /plan-customer
     ▼
  ecosystem    How the products fit together — shared services, dependencies
     │         optional (multi-product) · PM · /plan-ecosystem
     ▼
  product      One shippable thing — mission, roadmap, architecture
     │         one-time per product · PM + Tech · /plan-product
     ▼
  epic         A coherent feature surface — product brief + tech plan
     │         recurring · PM / Tech · /plan-epic
     ▼
  spec         One unit of work — the source of truth + tasks.md
               recurring · PM / Tech · /shape-spec
```

Each level answers a different question:

| Level | Answers |
|---|---|
| customer | who we're building for, and why they pay |
| ecosystem | what else is in play around this |
| product | what we're building |
| epic | which slice we're on now |
| spec | what exactly gets built, and how we'll know it's done |

**The trick:** every level reads the ones above it, so a spec arrives already
grounded in its epic, product, and customer. You never re-explain context to
the agent — the hierarchy is the context.
