---
id: LA-EXP-T63
kind: test
title: A flow page shows its steps in order as a table
parent: LA-EXP
test_type: acceptance
run_by: app/test/flow-steps.test.tsx
links:
  proves: [LA-EXP-UC06-R01, LA-EXP-F03-R01]
---
Opens a flow with three steps written out of order and expects the Steps table with its four columns (Step, What happens, Uses, Carries out), rows in step order, and each cell linking the IDs.
