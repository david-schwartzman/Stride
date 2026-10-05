---
id: why
title: The problem it solves
tracks: [techlead, new-project, pm, quick]
ground: none
---

Work gets decided in a meeting, argued in Slack, implemented in a PR, changed
twice, and hotfixed in production. Six months later nobody can answer:

> "What does this actually do, and why is it like that?"

Docs don't fix this on their own — docs written *beside* the work rot, because
keeping them true is somebody's unpaid second job.

**SoftwareOS makes the doc the work.** You don't write a spec and then build;
you run `/shape-spec`, and the spec is what the agent builds from. Bugs and
change requests edit that same spec. The doc can't drift, because it's the
input, not the summary.

Three rules the whole framework hangs on:

1. **The spec is the single source of truth** — what was built, and why.
2. **Every level reads the levels above it** — context flows down for free.
3. **Changes edit in place** — never a second doc that contradicts the first.
