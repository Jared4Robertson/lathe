---
id: LA-AUT-T02
kind: test
title: A record points at the code that builds it (file) and the code that proves it (run_by)
parent: LA-AUT
test_type: unit
run_by: lathe/test/records.test.ts
links:
  proves: [LA-AUT-UC01-R04]
---
Expects a component's `file` and a test's `run_by` to be loaded as repo-relative paths and the test to count towards coverage.
