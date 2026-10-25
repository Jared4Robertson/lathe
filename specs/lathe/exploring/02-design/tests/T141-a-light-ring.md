---
id: LA-EXP-T141
kind: test
title: "A light ring: at most six context children per parent, a chip for the rest, at most forty in all"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-EXP-UC03-R11, LA-EXP-DR50]
---
Expects six context requirements and a chip "+1 more UC requirement" leading to their parent (a use case with one kind of child has no group for them), after them in the column, and a crowded folder held to forty context nodes, chips included.
