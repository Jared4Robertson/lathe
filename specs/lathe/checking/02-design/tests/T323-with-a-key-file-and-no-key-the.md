---
id: LA-CHK-T323
kind: test
title: With a key_file and no key, the proved IDs are looked for in the key file
parent: LA-CHK
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-CHK-UC27-R02, LA-CHK-DR205]
---
Expects a test with a key file and no key to prove the domain rule the key file names, with no problem, and every proof-file problem in the fixture to come from the one test whose key the key file lacks.
