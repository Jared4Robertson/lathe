---
id: LA-AUT-T44
kind: test
title: A step with no order is reported once, as a missing required field
parent: LA-AUT
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-AUT-UC07-R02, LA-CHK-DR12]
---
Expects only `missing-required-field` on a step with no order.
