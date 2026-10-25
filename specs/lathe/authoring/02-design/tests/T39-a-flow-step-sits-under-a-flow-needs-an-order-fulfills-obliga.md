---
id: LA-AUT-T39
kind: test
title: A flow step sits under a flow, needs an order, fulfills obligations and uses views, endpoints and components
parent: LA-AUT
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-AUT-UC06-R01]
---
Loads a flow written as steps and expects the `flow_step` kind with its parent and required field, its six relation rules, and a step loaded with its order and links.
