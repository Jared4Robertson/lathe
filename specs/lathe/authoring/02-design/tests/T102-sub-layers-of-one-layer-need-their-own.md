---
id: LA-AUT-T102
kind: test
title: Sub-layers of one layer need their own orders; they may reuse the orders of layers elsewhere
parent: LA-AUT
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-AUT-UC13-R05, LA-AUT-DR42]
---
Expects a `layer-order` error on each of two sub-layers of one layer with the same order (1 and 01), naming the parent layer, and none for a sub-layer that shares an order with a layer in the domain.
