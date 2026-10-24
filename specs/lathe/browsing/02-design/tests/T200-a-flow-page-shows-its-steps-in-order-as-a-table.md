---
id: LA-BRW-T200
kind: test
title: A flow page shows its steps in order as a table
parent: LA-BRW
test_type: acceptance
run_by: app/test/flow-steps.test.tsx
links:
  proves: [LA-BRW-UC80-R01, LA-BRW-DR90]
---
Opens a flow with three steps written out of order and expects the Steps table with its four columns, rows in step order, and each cell linking the IDs.
