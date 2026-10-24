---
id: LA-CHK-T114
kind: test
title: "A test with a key is accepted when its file contains the key, though it names no ID"
parent: LA-CHK
test_type: unit
run_by: lathe/test/proof-claims.test.ts
links:
  proves: [LA-CHK-UC12-R03, LA-CHK-DR62]
---
Loads a test with a `key` whose file contains the key and names no ID, and expects no error on it.
