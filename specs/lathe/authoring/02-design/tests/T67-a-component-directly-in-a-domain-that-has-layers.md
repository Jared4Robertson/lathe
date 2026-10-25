---
id: LA-AUT-T67
kind: test
title: A component directly in a domain that has layers is a warning; a domain without layers is fine
parent: LA-AUT
test_type: unit
run_by: lathe/test/layers.test.ts
links:
  proves: [LA-AUT-UC10-R03, LA-AUT-DR44, LA-AUT-DR45]
---
Expects one `component-outside-layer` warning for the component under a domain with layers, and none for a component in a layer or in a domain with no layers.
