---
id: LA-TRC-T04
kind: test
title: Coverage counts every obligation kind in meta-model order, including interaction requirements
parent: LA-TRC
test_type: unit
run_by: lathe/test/coverage.test.ts
links:
  proves: [LA-TRC-UC02-R01, LA-AUT-DR12]
---
Loads a fixture with domain rules, requirements and interaction requirements and expects one entry per obligation kind, in meta-model order, with the right counts.
