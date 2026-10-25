---
id: LA-TRC-T03
kind: test
title: Coverage gaps are warnings, so an unfinished design has no errors
parent: LA-TRC
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-TRC-UC01-R03]
---
Loads the unfinished fixture and expects `unsatisfied`, `unproved` and `component-file-missing` warnings and no errors.
