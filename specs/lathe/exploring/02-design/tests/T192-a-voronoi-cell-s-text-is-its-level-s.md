---
id: LA-EXP-T192
kind: test
title: "Every Voronoi cell at one level has one text scale, and every cell is sized to hold its label at it, wrapped on whole words inside its outline"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/voronoi.test.ts
links:
  proves: [LA-EXP-DR64, LA-EXP-DR58]
---
Expects a leaf with a long title given more than 1.5 times the area of its short-titled siblings at the same text scale, and in every test map every cell at one level at one scale, between the level below's and 3 times it, labeled, its label's box inside its outline, a parent's above where its children start, every title line but the last ending after a space and no line wider than the label; one map per index whatever the focus, the same map for a spec loaded again with the same tree, and the worker's layout of the tree read from the index equal to the one made here.
