---
id: LA-CHK-T01
kind: test
title: Duplicate IDs are reported as errors
parent: LA-CHK
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-MOD-DR06, LA-CHK-UC01-R04]
---
Loads a fixture in which two record files share an ID and expects a `duplicate-id` error naming that ID.
