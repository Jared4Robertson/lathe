---
id: LA-EXP-T165
kind: test
title: A parent is as tall as its children stacked, starting at its top, each child beside it, nothing overlapping
parent: LA-EXP
test_type: unit
run_by: app/test/graph/map.test.ts
links:
  proves: [LA-EXP-DR57, LA-EXP-UC04-R08]
---
Builds the maps of three workspaces and expects every leaf one node high, every parent's children stacked from its top to its bottom a row gap apart, each child in the next level right of it, no two boxes in a level overlapping, and the tree the nav's.
