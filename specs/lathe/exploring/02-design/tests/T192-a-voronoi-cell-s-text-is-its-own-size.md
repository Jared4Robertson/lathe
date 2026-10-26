---
id: LA-EXP-T192
kind: test
title: "Each Voronoi cell's label is at its own size, wrapped on whole words inside its outline"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/voronoi.test.ts
links:
  proves: [LA-EXP-DR64, LA-EXP-DR58]
---
Expects every cell of the test maps labeled, its label's box inside its outline, a parent's above where its children start, its text scale never above its own size's and, for every leaf at its own scale, the same ratio of scale to the square root of its area; every title line but the last ending after a space and no line wider than the label; one map per index whatever the focus, the same map for a spec loaded again with the same tree, and the worker's layout of the tree read from the index equal to the one made here.
