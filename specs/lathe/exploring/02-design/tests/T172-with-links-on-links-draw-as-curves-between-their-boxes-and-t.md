---
id: LA-EXP-T172
kind: test
title: With Links on, links draw as curves between their boxes, and the edge hints count the linked records past each edge
parent: LA-EXP
test_type: component
run_by: app/test/graph/context.test.tsx
links:
  proves: [LA-EXP-DR49, LA-EXP-UC03-R12]
---
Checks the hints' arithmetic, then turns Links on for a requirement and expects every linked record drawn wherever it is, each link a curve, and the parent lines straight and level.
