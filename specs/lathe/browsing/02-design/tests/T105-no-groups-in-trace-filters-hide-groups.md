---
id: LA-BRW-T105
kind: test
title: Trace mode has no groups, and filters hide groups with their kind or the parent relation
parent: LA-BRW
test_type: unit
run_by: app/test/graph/groups.test.ts
links:
  proves: [LA-BRW-UC40-R01, LA-BRW-DR20]
---
Expects no groups in a trace, no group for a hidden kind, no groups at all when parent/child is hidden, and the same graph every time.
