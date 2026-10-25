---
id: LA-CHK-T270
kind: test
title: A layer sits in a domain with an order, and holds only components
parent: LA-CHK
test_type: unit
run_by: lathe/test/layers.test.ts
links:
  proves: [LA-CHK-UC22-R01, LA-CHK-DR160, LA-CHK-DR161, LA-CHK-DR169]
---
Expects the `layer` kind under a domain with a required `order` in the Technical specification folder, `component` under a domain or a layer, no other kind under a layer, and a product's own layer records, with no errors.
