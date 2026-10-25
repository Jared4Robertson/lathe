---
id: LA-AUT-T74
kind: test
title: A role other than root or child is an entity-role error
parent: LA-AUT
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-AUT-UC11-R03, LA-AUT-DR50, LA-AUT-DR57]
---
Expects an `entity-role` error for role `leaf`, none for `ROOT` or `Child`, and only `missing-required-field` for a missing role.
