---
id: LA-TRC-T79
kind: test
title: With a key_file, the key is looked for in that file, and a key it lacks is test-file-missing-id
parent: LA-TRC
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-TRC-UC03-R05, LA-TRC-DR30]
---
Expects a test whose `run_by` never names its key, but whose key file does, to prove its domain rule with no problem, and a `test-file-missing-id` error naming the key file for a key the key file lacks.
