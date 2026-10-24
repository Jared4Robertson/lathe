---
id: LA-CHK-T135
kind: test
title: Structural gaps are warnings and break nothing
parent: LA-CHK
test_type: unit
run_by: lathe/test/structure.test.ts
links:
  proves: [LA-CHK-DR80]
---
Expects every structural check to fire in the warnings fixture, each as a warning, with no errors, and none in a workspace without the gaps.
