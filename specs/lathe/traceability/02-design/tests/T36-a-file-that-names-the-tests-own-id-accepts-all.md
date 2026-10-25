---
id: LA-TRC-T36
kind: test
title: A file that names the test's own ID accepts all its claims
parent: LA-TRC
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-TRC-UC05-R01, LA-TRC-DR11]
---
Loads a test that proves two rules while its file names only the test's ID, and expects no error on it.
