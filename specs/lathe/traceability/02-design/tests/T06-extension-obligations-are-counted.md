---
id: LA-TRC-T06
kind: test
title: An extension's obligation kind and design and proof relations are counted like the defaults
parent: LA-TRC
test_type: unit
run_by: lathe/test/coverage.test.ts
links:
  proves: [LA-TRC-UC02-R01, LA-TRC-UC02-R02, LA-AUT-DR12, LA-TRC-DR03]
---
Loads a fixture whose extension adds an obligation kind and design and proof relations, one of them from a non-component kind, and expects them counted, with the non-component design counting as designed but not built.
