---
id: LA-CHK-T194
kind: test
title: A step that fulfills something its flow does not carry out is a warning naming what it compared
parent: LA-CHK
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-CHK-UC17-R04, LA-CHK-DR111]
---
Expects `flow-step-fulfills-outside-flow` for another use case's requirement, a rule only that use case applies, and an interaction requirement that fulfills it, each naming the flow's use cases.
