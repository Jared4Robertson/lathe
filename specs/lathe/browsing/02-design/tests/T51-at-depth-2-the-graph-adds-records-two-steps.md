---
id: LA-BRW-T51
kind: test
title: At depth 2 the graph adds records two steps away, each at its distance
parent: LA-BRW
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-BRW-UC20-R01]
---
Expects the depth-2 neighborhood to add the records two steps away, each record to know which record it was reached from, and the result to be the same on every call.
