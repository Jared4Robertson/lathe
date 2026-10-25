---
id: LA-CHK-T293
kind: test
title: A role other than root or child is an entity-role error
parent: LA-CHK
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-CHK-UC24-R03, LA-CHK-DR180, LA-CHK-DR187]
---
Expects an `entity-role` error for role `leaf`, none for `ROOT` or `Child`, and only `missing-required-field` for a missing role.
