---
id: LA-TRC-T37
kind: test
title: A file that names every ID the test proves needs no test ID
parent: LA-TRC
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-TRC-DR12]
---
Loads a test that proves two rules while its file names both rules and not the test, and expects no error on it.
