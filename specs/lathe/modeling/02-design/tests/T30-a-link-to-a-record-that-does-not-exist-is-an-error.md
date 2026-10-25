---
id: LA-MOD-T30
kind: test
title: A link to a record that does not exist is an error
parent: LA-MOD
test_type: unit
run_by: lathe/test/records.test.ts
links:
  proves: [LA-MOD-DR10]
---
Loads a use case that applies a missing rule and expects a `dangling-link` error.
