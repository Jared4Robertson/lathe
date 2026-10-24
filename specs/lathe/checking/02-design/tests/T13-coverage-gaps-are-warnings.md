---
id: LA-CHK-T13
kind: test
title: Coverage gaps are warnings, so an unfinished design has no errors
parent: LA-CHK
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-CHK-UC02-R03]
---
Loads the unfinished fixture and expects `unsatisfied`, `unproved` and `component-file-missing` warnings and no errors.
