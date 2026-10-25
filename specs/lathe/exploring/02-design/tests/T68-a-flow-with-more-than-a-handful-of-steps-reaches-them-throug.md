---
id: LA-EXP-T68
kind: test
title: A flow's steps hang under it directly, or through a group beside other kinds
parent: LA-EXP
test_type: unit
run_by: app/test/graph/flow-steps.test.ts
links:
  proves: [LA-EXP-UC06-R04, LA-EXP-F03-R02]
---
Expects a flow with six steps and nothing else to reach them directly, and one that also has an interaction requirement to reach them through a "Flow steps (6)" group in the next column, its steps framed at depth 2, and in the map each step under the group and the group under the flow.
