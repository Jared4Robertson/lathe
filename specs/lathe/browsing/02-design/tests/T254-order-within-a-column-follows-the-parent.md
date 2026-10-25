---
id: LA-BRW-T254
kind: test
title: Order within a column follows the parent, then kind, then ID
parent: LA-BRW
test_type: unit
run_by: app/test/graph/columns.test.ts
links:
  proves: [LA-BRW-DR120, LA-BRW-DR20]
---
Expects use cases by ID, their children in their parents' order, a domain's groups in kind order, rows numbered from 0 and drawn top to bottom, and the same order after re-centring.
