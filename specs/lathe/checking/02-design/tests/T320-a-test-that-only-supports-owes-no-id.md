---
id: LA-CHK-T320
kind: test
title: A test that only supports owes no ID in its file, but its run_by must still exist
parent: LA-CHK
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-CHK-UC27-R01, LA-CHK-DR204]
---
Expects no problem for an automated check that supports a requirement through a file naming no ID and with no key, nor for a planned one, and a `test-file-missing` error for a check whose `run_by` does not exist.
