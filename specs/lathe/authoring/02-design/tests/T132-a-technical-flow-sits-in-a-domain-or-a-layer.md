---
id: LA-AUT-T132
kind: test
title: A technical flow sits in a domain or a layer and deepens a flow, and its steps have an order, use components and satisfy obligations
parent: LA-AUT
test_type: unit
run_by: lathe/test/apis-and-design-flows.test.ts
links:
  proves: [LA-AUT-UC17-R01, LA-AUT-UC17-R02, LA-AUT-UC17-R03]
---
Expects the `design_flow` and `design_step` kinds with their parents and required field, their seven relation rules (with meets, to a standard rule), a step loaded with its order, transaction, locks and statements, and a refused path sharing an order with the main one.
