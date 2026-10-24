---
id: LA-CHK-T51
kind: test
title: A test file that names neither the test nor a record it proves is an error
parent: LA-CHK
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-CHK-UC08-R01]
---
Loads an automated test that proves one rule while its file names another, and expects a `test-file-missing-id` error naming the file.
