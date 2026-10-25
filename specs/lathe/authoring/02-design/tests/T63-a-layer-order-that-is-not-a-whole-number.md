---
id: LA-AUT-T63
kind: test
title: A layer order that is not a whole number is a layer-order error
parent: LA-AUT
test_type: unit
run_by: lathe/test/layers.test.ts
links:
  proves: [LA-AUT-UC09-R02, LA-AUT-DR42]
---
Expects one `layer-order` error for each layer whose order is `first` or `2.5`, quoting the order.
