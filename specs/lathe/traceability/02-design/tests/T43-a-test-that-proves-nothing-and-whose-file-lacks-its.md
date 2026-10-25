---
id: LA-TRC-T43
kind: test
title: A test that proves nothing and whose file lacks its ID is a test-file-missing-id error
parent: LA-TRC
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-TRC-UC05-R04]
---
Loads a test with no `proves` links whose file does not name it, and expects one `test-file-missing-id` error.
