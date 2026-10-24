---
id: LA-CHK-T192
kind: test
title: Two steps of one flow with the same order are an error, 1 and 01 alike
parent: LA-CHK
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-CHK-UC17-R03, LA-CHK-DR110]
---
Expects `flow-step-order` on both steps of one flow with orders 1 and 01, each naming the other, and none on steps of other flows that also have order 1.
