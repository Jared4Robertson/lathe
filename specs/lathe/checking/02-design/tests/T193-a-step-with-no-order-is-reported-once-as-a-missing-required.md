---
id: LA-CHK-T193
kind: test
title: A step with no order is reported once, as a missing required field
parent: LA-CHK
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-CHK-UC17-R02, LA-CHK-DR113]
---
Expects only `missing-required-field` on a step with no order.
