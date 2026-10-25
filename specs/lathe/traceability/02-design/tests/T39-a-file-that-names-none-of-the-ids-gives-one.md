---
id: LA-TRC-T39
kind: test
title: A file that names none of the IDs gives one error per proved ID, naming the test, the ID and the file
parent: LA-TRC
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-TRC-UC05-R02]
---
Loads a test that proves three rules while its file names none of them nor the test, and expects three `proof-not-in-file` errors whose messages name the test, the rule and the file, and no `test-file-missing-id`.
