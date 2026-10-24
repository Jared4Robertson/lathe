---
id: LA-CHK-T40
kind: test
title: Coverage counts every obligation kind in meta-model order, including interaction requirements
parent: LA-CHK
test_type: unit
run_by: lathe/test/coverage.test.ts
links:
  proves: [LA-CHK-UC07-R01, LA-CHK-DR20]
---
Loads a fixture with domain rules, requirements and interaction requirements and expects one entry per obligation kind, in meta-model order, with the right counts.
