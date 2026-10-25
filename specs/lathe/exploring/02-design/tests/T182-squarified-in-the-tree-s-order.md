---
id: LA-EXP-T182
kind: test
title: "Squarified in the tree's order, the area shared exactly"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/nested.test.ts
links:
  proves: [LA-EXP-DR62]
---
Squarifies four equal weights in a square into a 2 by 2 grid in reading order, and six unequal weights into cells that keep their order, share the area exactly, stay inside the rectangle and stay near square; a weight of 0 gets an empty cell.
