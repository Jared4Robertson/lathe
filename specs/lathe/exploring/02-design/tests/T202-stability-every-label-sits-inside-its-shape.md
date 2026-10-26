---
id: LA-EXP-T202
kind: test
title: "Stability: in the Tree view every label line and badge sits inside its box's shape, and in the Nested view every record shows its shape's mark"
parent: LA-EXP
test_type: acceptance
run_by: app/stability/graph.spec.ts
links:
  proves: [LA-EXP-UC03-R04, LA-EXP-DR65, LA-PAT-APP-UX-R08]
---
Opens a domain's graph in the Tree view at each depth, and for every drawn box hit-tests the corners of each label line and badge, expecting each to land on its own box, inside its clipped or rounded outline; then in the Nested view expects every record box to carry its kind's shape mark and no outline of its own.
