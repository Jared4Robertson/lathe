---
id: LA-CHK-T04
kind: test
title: A test whose run_by file lacks its ID is reported as an error
parent: LA-CHK
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-MOD-DR12, LA-CHK-UC01-R04]
---
Loads a fixture with a test record whose `run_by` file exists but does not contain the record's ID and expects a `test-file-missing-id` error.
