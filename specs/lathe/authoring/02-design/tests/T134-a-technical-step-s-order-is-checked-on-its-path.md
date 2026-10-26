---
id: LA-AUT-T134
kind: test
title: A technical step's order is checked on its path, as a flow step's is
parent: LA-AUT
test_type: unit
run_by: lathe/test/apis-and-design-flows.test.ts
links:
  proves: [LA-AUT-UC17-R05, LA-AUT-DR78]
---
Expects `step-order` errors worded for a technical step on two steps with orders 1 and 01, on an order that is not a whole number, and once on a path that skips a number, and a missing order only as a missing required field.
