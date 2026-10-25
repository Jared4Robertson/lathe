---
id: LA-CHK-T332
kind: test
title: Sub-layers of one layer need their own orders; they may reuse the orders of layers elsewhere
parent: LA-CHK
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-CHK-UC27-R05, LA-CHK-DR162]
---
Expects a `layer-order` error on each of two sub-layers of one layer with the same order (1 and 01), naming the parent layer, and none for a sub-layer that shares an order with a layer in the domain.
