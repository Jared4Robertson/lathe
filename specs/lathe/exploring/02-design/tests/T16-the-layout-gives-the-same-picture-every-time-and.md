---
id: LA-EXP-T16
kind: test
title: The layout gives the same map every time, whatever the focus, with no overlaps
parent: LA-EXP
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-EXP-DR04, LA-EXP-DR57]
---
Builds the map of the test workspace twice and expects the same map for the same index and the same places and sizes for an index built again, no two boxes overlapping, the nav's order within a level, and a trace's picture centered on its focus.
