---
id: LA-AUT-T40
kind: test
title: A step order that is not a whole number is an error
parent: LA-AUT
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-AUT-UC06-R02]
---
Expects `flow-step-order` on a step whose order is "two", quoting it, as an error.
