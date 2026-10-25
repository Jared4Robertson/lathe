---
id: LA-TRC-T13
kind: test
title: An automated test needs a run_by; a manual or planned test does not
parent: LA-TRC
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-TRC-UC03-R03]
---
Loads automated tests with no `run_by` (one by its state, one by default) and expects `test-run-by-missing` on each, and a planned and a manual test with no `run_by` and expects no error on them.
