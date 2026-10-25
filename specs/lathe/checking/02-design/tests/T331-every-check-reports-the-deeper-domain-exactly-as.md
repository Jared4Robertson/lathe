---
id: LA-CHK-T331
kind: test
title: Every check reports the deeper domain exactly as the flatter one, apart from its extra layer
parent: LA-CHK
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-CHK-UC27-R05, LA-CHK-DR210, LA-CHK-DR166]
---
Expects the twin domains' problems, other than those on layers, to be equal ID for ID, covering file, proof and coverage warnings, and no `rule-not-applied`, `obligation-outside-domain`, `component-outside-layer` or `unsatisfied` problem.
