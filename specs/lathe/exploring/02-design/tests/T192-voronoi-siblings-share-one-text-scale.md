---
id: LA-EXP-T192
kind: test
title: In the Voronoi map siblings share one text scale, at most their size's, and each label wraps on whole words inside its outline
parent: LA-EXP
test_type: unit
run_by: app/test/graph/voronoi.test.ts
links:
  proves: [LA-EXP-DR64, LA-EXP-DR58]
---
Expects every group of sibling cells in the test maps to share one text scale, above 0 and at most the smallest sibling's square root of its area over 400; every cell's label box inside its outline, a parent's above where its children start; every title line but the last ending after a space and no line wider than the label; one map per index whatever the focus, the same map for a spec loaded again with the same tree, and the worker's layout of the tree read from the index equal to the one made here.
