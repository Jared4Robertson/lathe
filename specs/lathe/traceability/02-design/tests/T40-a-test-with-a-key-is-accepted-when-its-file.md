---
id: LA-TRC-T40
kind: test
title: A test with a key is accepted when its file contains the key, though it names no ID
parent: LA-TRC
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-TRC-UC05-R03, LA-TRC-DR13]
---
Loads a test with a `key` whose file contains the key and names no ID, and expects no error on it.
