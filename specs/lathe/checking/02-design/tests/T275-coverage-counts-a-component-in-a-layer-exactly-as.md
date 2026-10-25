---
id: LA-CHK-T275
kind: test
title: Coverage counts a component in a layer exactly as one directly in the domain
parent: LA-CHK
test_type: unit
run_by: lathe/test/layers.test.ts
links:
  proves: [LA-CHK-UC22-R04, LA-CHK-DR167, LA-CHK-DR168]
---
Loads two domains alike except that one puts its components in layers, and expects the same coverage for both, IDs aside: the same designed and built requirements and domain rules, and the same owed pattern rule designed by the layered component.
