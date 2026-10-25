---
id: LA-EXP-T13
kind: test
title: Depth counts levels of the tree below the focus, stages and folders included, with the parent kept
parent: LA-EXP
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-EXP-UC03-R01, LA-EXP-DR46]
---
Frames a requirement at depths 1 to 3 (the same picture: it has nothing below it), the Define stage at each depth (its folders, their records, their children), and an aggregate, and expects the parent kept, each node's distance and the node it was reached from, only parent lines, and no sibling or link.
