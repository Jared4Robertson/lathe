---
id: LA-AUT-T05
kind: test
title: An ID that does not match the pattern is an error
parent: LA-AUT
test_type: unit
run_by: lathe/test/records.test.ts
links:
  proves: [LA-AUT-DR02]
---
Loads a record with a lowercase ID and expects a `bad-id` error.
