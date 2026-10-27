---
id: LA-EXP-T20
kind: test
title: Nodes and lines show stage, relation, errors and gaps, with a legend
parent: LA-EXP
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC03-R04]
---
Expects each node drawn in its stage's colors, an error badge on a test with an error and none on a clean view, a gap badge on a rule with a gap, the lines' relation families, and a legend.
