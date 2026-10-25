---
id: LA-MOD-T27
kind: test
title: An ID that does not match the pattern is an error
parent: LA-MOD
test_type: unit
run_by: lathe/test/records.test.ts
links:
  proves: [LA-MOD-DR07]
---
Loads a record with a lowercase ID and expects a `bad-id` error.
