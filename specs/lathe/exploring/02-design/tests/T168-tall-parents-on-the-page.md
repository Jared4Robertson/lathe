---
id: LA-EXP-T168
kind: test
title: Tall parents on the page carry their height and content scale
parent: LA-EXP
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC04-R08, LA-EXP-DR54]
---
Opens a domain's graph at depth 2 and expects each parent's box to be as tall as its children's stack, a parent to set `--node-scale` above 1 while a leaf sets none, and every parent line between two drawn nodes to be level.
