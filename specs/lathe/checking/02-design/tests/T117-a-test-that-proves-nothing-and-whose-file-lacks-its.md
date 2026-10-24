---
id: LA-CHK-T117
kind: test
title: "A test that proves nothing and whose file lacks its ID is a test-file-missing-id error"
parent: LA-CHK
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-CHK-UC12-R04]
---
Loads a test with no `proves` links whose file does not name it, and expects one `test-file-missing-id` error.
