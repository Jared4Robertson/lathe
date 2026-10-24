---
id: LA-CHK-T61
kind: test
title: A planned test that names a file not written yet is a warning, not an error
parent: LA-CHK
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-CHK-UC08-R03]
---
Loads a workspace with a planned test whose `run_by` file does not exist and expects one `test-file-missing` warning and no errors.
