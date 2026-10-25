---
id: LA-EXP-T16
kind: test
title: The layout gives the same picture every time and keeps the order within a column
parent: LA-EXP
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-EXP-DR04]
---
Lays out a depth-2 graph twice and expects the same positions and no overlapping boxes, then re-centers on a neighbor and expects the siblings in one column in the same order.
