---
id: LA-AUT-T69
kind: test
title: Coverage counts a component in a layer exactly as one directly in the domain
parent: LA-AUT
test_type: unit
run_by: lathe/test/layers.test.ts
links:
  proves: [LA-AUT-UC10-R04, LA-AUT-DR47, LA-AUT-DR48]
---
Loads two domains alike except that one puts its components in layers, and expects the same coverage for both, IDs aside: the same designed and built requirements and domain rules, and the same owed pattern rule designed by the layered component.
