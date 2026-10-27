---
id: LA-EXP-T165
kind: test
title: A parent spans its children stacked, an equal part each, from its top edge to its bottom edge, each child beside it, nothing overlapping
parent: LA-EXP
test_type: unit
run_by: app/test/graph/map.test.ts
links:
  proves: [LA-EXP-DR57, LA-EXP-UC04-R08]
---
Builds the maps of three workspaces, two synthetic trees and a product with a busy part and a quiet one, and expects every root the product box's height, every parent's children of one height, stacked from its top to its bottom a tenth of each one's part apart, each in the next level right of it, no two boxes in a level overlapping, the busy part and the quiet one the same height with the busy one's children smaller, and the tree the nav's.
