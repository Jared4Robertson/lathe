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
Expects a flow with six steps and nothing else to point straight at them, and a flow with six steps and an interaction requirement to reach its steps through a "Flow steps (6)" group, folded until a step is focused.
