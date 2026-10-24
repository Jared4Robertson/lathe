---
id: LA-CHK-T191
kind: test
title: A step order that is not a whole number is an error
parent: LA-CHK
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-CHK-UC17-R02]
---
Expects `flow-step-order` on a step whose order is "two", quoting it, as an error.
