---
id: LA-AUT-T101
kind: test
title: Every check reports the deeper domain exactly as the flatter one, apart from its extra layer
parent: LA-AUT
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-AUT-UC13-R05, LA-AUT-DR70, LA-AUT-DR46]
---
Expects the twin domains' problems, other than those on layers, to be equal ID for ID, covering file, proof and coverage warnings, and no `rule-not-applied`, `obligation-outside-domain`, `component-outside-layer` or `unsatisfied` problem.
