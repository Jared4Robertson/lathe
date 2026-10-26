---
id: LA-EXP-T187
kind: test
title: "In the Nested map, built from the leaves up, each box has a text scale of its own, in proportion to it, and every label fits"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/nested.test.ts
links:
  proves: [LA-EXP-DR62, LA-EXP-DR58]
---
Expects a box as wide as its label on one line and two lines tall to hold it at about scale 1, a square box half as wide to hold larger text by wrapping on whole words, no word wider than its box, a bigger box to hold a bigger label, a label's least box nearer a 3 by 2 shape than one long line and holding it at scale 1, a parent's header room a fifth of its size and at most 0.4 of its height, children sharing a room each at least its least area and summing to it, every box with a label that fits it (a leaf's in its height, a parent's header within its room), each box's scale the largest its label fits at, and the same map object for an index whatever the focus.
