---
id: LA-AUT-T46
kind: test
title: A step may fulfill its flow's requirements, applied rules and the interaction requirements reached from them
parent: LA-AUT
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-AUT-UC07-R04, LA-AUT-DR25]
---
Expects no warning for steps that fulfill a requirement of the carried-out use case, a rule it applies, an endpoint interaction requirement that fulfills one of them, and an interaction requirement under the flow.
