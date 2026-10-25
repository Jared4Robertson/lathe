---
id: LA-CHK-T231
kind: test
title: An interaction requirement and a flow step may fulfill a pattern rule
parent: LA-CHK
test_type: unit
run_by: lathe/test/patterns-like-s2.test.ts
links:
  proves: [LA-CHK-UC19-R08]
---
Expects `fulfills` rules from `interaction_requirement` and `flow_step` to `pattern_rule`, and no `relation-not-allowed` for records that use them.
