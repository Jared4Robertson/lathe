---
id: LA-EXP-T149
kind: test
title: A chip leads to the group or parent of the children it counts, and edge hints count the ring past each edge and pan that way
parent: LA-EXP
test_type: component
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-EXP-UC03-R11, LA-EXP-UC03-R12]
---
Expects the edge hints' counts and half-canvas pans, then clicks a chip and expects the center to move to the parent of the children it counts.
