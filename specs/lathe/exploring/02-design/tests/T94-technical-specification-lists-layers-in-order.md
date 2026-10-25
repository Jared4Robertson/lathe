---
id: LA-EXP-T94
kind: test
title: Technical specification lists layers in order, each with its components, then those outside any layer
parent: LA-EXP
test_type: unit
run_by: app/test/layers-and-test-groups.test.tsx
links:
  proves: [LA-EXP-UC09-R01, LA-EXP-DR26]
---
Expects three layers whose order is not their ID order in their order, each with its components, then "Components outside any layer", the folder counting components; and a domain with no layers listing its components directly.
