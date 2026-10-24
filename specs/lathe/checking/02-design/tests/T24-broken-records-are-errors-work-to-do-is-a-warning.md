---
id: LA-CHK-T24
kind: test
title: Broken records are errors and work to do is a warning
parent: LA-CHK
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-CHK-DR05]
---
Expects every problem in every fixture to be a warning when it is work to do (unsatisfied, unproved, a use case with no requirements, a component file not written yet) and an error otherwise.
