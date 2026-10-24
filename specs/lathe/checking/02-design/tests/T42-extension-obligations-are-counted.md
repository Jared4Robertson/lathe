---
id: LA-CHK-T42
kind: test
title: An extension's obligation kind and design and proof relations are counted like the defaults
parent: LA-CHK
test_type: unit
run_by: lathe/test/coverage.test.ts
links:
  proves: [LA-CHK-UC07-R01, LA-CHK-UC07-R02, LA-CHK-DR20, LA-CHK-DR22]
---
Loads a fixture whose extension adds an obligation kind and design and proof relations, one of them from a non-component kind, and expects them counted, with the non-component design counting as designed but not built.
