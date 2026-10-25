---
id: LA-CHK-T271
kind: test
title: A layer order that is not a whole number is a layer-order error
parent: LA-CHK
test_type: unit
run_by: lathe/test/layers.test.ts
links:
  proves: [LA-CHK-UC22-R02, LA-CHK-DR162]
---
Expects one `layer-order` error for each layer whose order is `first` or `2.5`, quoting the order.
