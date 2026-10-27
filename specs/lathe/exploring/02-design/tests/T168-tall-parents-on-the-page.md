---
id: LA-EXP-T168
kind: test
title: Tall parents carry their height and content scale, and every parent line is level
parent: LA-EXP
test_type: acceptance
run_by: app/test/graph/GraphPage.test.tsx
links:
  proves: [LA-EXP-UC04-R08, LA-EXP-DR58]
---
Opens a domain's graph at depth 2 and expects, in the drawn scene, the domain taller than its stages stacked with a text scale above 1, a leaf at box scale 1, and every parent line drawn level.
