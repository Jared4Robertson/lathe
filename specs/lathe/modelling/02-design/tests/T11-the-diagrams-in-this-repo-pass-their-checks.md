---
id: LA-MOD-T11
kind: test
title: The diagrams in this repo pass their checks
parent: LA-MOD
test_type: integration
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-DR02, LA-MOD-DR03, LA-MOD-DR04, LA-MOD-DR05, LA-MOD-DR13, LA-MOD-DR14, LA-MOD-DR15]
---
Loads every diagram registered in this repo's `model/diagrams.csv` and expects each to pass its checks.
