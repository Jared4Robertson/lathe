---
id: LA-AUT-T62
kind: test
title: A layer sits in a domain or a layer with an order, and holds components, sub-layers and technical flows
parent: LA-AUT
test_type: unit
run_by: lathe/test/layers.test.ts
links:
  proves: [LA-AUT-UC09-R01, LA-AUT-DR40, LA-AUT-DR41, LA-AUT-DR49]
---
Expects the `layer` kind under a domain or a layer with a required `order` in the Technical specification folder, `component` under a domain or a layer, no other kind but these and technical flows under a layer, and a product's own layer records, with no errors.
