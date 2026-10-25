---
id: LA-TRC-T81
kind: test
title: With a key_file and no key, the proved IDs are looked for in the key file
parent: LA-TRC
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-TRC-UC03-R05, LA-TRC-DR30]
---
Expects a test with a key file and no key to prove the domain rule the key file names, with no problem, and every proof-file problem in the fixture to come from the one test whose key the key file lacks.
