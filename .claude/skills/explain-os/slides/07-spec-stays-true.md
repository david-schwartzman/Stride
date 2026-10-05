---
id: spec-stays-true
title: The spec stays true
tracks: [techlead, new-project, pm, quick]
ground: none
---

This is the rule most people get wrong in their first week.

**Bugs never get their own doc.** There is no bugs folder, and there never will
be one. `/hotfix` triages the report, fixes the defect **with a regression
test**, and records the correction as a Changelog row (`Type=hotfix`) on the
**owning spec** — linking the Jira/Monday ticket in the Ref column. If the root
cause was a missing or weak rule, it strengthens the standard too.

**Change requests edit the spec in place.** `/spec-changes` rewrites the
affected sections and appends a Changelog row (`Type=change`).

```
❌  a bug doc, a v2 spec, a "revised approach" note
✅  the same spec.md, edited, with a Changelog row saying what moved and why
```

**Why so strict:** a second document that contradicts the first is worse than
no document — now the reader has to guess which one is real. One spec, edited
forever, with a trail of *how it got here*, is always answerable.

Your tracker still holds the ticket. The spec Changelog is the in-repo record.
