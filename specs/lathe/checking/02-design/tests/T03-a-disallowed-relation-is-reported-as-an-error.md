---
id: LA-CHK-T03
kind: test
title: A disallowed relation is reported as an error
parent: LA-CHK
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-MOD-DR11, LA-CHK-UC01-R04]
---
Loads a fixture with a link whose relation is not allowed between its source and target kinds and expects a `relation-not-allowed` error.
