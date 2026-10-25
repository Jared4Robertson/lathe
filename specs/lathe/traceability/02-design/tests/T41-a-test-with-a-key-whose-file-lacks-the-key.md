---
id: LA-TRC-T41
kind: test
title: A test with a key whose file lacks the key is an error, even if the file names the test's ID
parent: LA-TRC
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-TRC-UC05-R03, LA-TRC-DR13]
---
Loads a test with a `key` whose file names the test and its rule but not the key, and expects exactly one `test-file-missing-id` error quoting the key.
