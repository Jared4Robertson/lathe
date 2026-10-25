---
id: LA-BRW-T280
kind: test
title: Technical specification lists layers in order, each with its components, then those outside any layer
parent: LA-BRW
test_type: unit
run_by: app/test/layers-and-test-groups.test.tsx
links:
  proves: [LA-BRW-UC110-R01, LA-BRW-DR143]
---
Expects three layers whose order is not their ID order in their order, each with its components, then "Components outside any layer", the folder counting components; and a domain with no layers listing its components directly.
