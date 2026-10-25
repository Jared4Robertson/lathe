---
id: LA-EXP-T17
kind: test
title: The breadcrumb trail grows with each visit and cuts back on a revisit
parent: LA-EXP
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-EXP-UC03-R02]
---
Expects the trail to add new records, cut back to a record visited before, and keep only the most recent records.
