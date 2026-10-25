---
id: LA-EXP-T187
kind: test
title: "In the Nested map every box at one level has one text scale, its label wrapped on whole words, and a box whose label does not fit is plain"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/nested.test.ts
links:
  proves: [LA-EXP-DR62, LA-EXP-DR58]
---
Expects a box as wide as its label on one line and two lines tall to hold it at about scale 1, a square box half as wide to hold larger text by wrapping on whole words, no word wider than its box, a parent's header room its share of its box's size (0.4 over one leaf, falling with the square root of the leaves to a fifth) and at most 0.4 of its height, a level's scale the largest that three quarters of its boxes by size can hold, one text scale for every box at a level, every fitting parent's header band within its room and every other parent's empty, and the same map object for an index whatever the focus.
