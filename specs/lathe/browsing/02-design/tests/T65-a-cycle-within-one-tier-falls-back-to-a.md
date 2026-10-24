---
id: LA-BRW-T65
kind: test
title: A cycle within one tier falls back to a radial layout that names it
parent: LA-BRW
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-BRW-UC20-R08]
---
Adds two aggregates that relate to each other and expects the cycle to be found and the radial fallback used, while a single link between aggregates, or links across tiers, keep the tiers.
