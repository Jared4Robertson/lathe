---
id: LA-TRC-T78
kind: test
title: A test that only supports owes no ID in its file, but its run_by must still exist
parent: LA-TRC
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-TRC-UC03-R04, LA-TRC-DR29]
---
Expects no problem for an automated check that supports a requirement through a file naming no ID and with no key, nor for a planned one, and a `test-file-missing` error for a check whose `run_by` does not exist.
