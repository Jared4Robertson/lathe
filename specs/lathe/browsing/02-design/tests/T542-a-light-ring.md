---
id: LA-BRW-T542
kind: test
title: "A light ring: at most six context children per parent, a chip for the rest, at most forty in all"
parent: LA-BRW
test_type: unit
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-BRW-UC20-R11, LA-BRW-DR305]
---
Expects six context requirements and a chip "+1 more UC requirement" leading to their parent (a use case with one kind of child has no group for them), after them in the column, and a crowded folder held to forty context nodes, chips included.
