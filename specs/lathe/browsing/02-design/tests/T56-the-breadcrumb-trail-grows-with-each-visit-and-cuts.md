---
id: LA-BRW-T56
kind: test
title: The breadcrumb trail grows with each visit and cuts back on a revisit
parent: LA-BRW
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-BRW-UC20-R02]
---
Expects the trail to add new records, cut back to a record visited before, and keep only the most recent records.
