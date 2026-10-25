---
id: LA-CHK-T273
kind: test
title: A component directly in a domain that has layers is a warning; a domain without layers is fine
parent: LA-CHK
test_type: unit
run_by: lathe/test/layers.test.ts
links:
  proves: [LA-CHK-UC22-R03, LA-CHK-DR164, LA-CHK-DR165]
---
Expects one `component-outside-layer` warning for the component under a domain with layers, and none for a component in a layer or in a domain with no layers.
