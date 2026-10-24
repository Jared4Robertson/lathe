---
id: LA-CHK-T04
kind: test
title: A test whose run_by file lacks its ID is reported as an error
parent: LA-CHK
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-MOD-DR12, LA-CHK-UC01-R04, LA-CHK-UC08-R01]
---
Loads a fixture with an automated test record whose `run_by` file exists but mentions neither the record's ID nor any record it proves (it proves none) and expects a `test-file-missing-id` error; a test whose file is gone gets `test-file-missing`, and a test whose file names it gets nothing.
