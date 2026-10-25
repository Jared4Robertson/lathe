---
id: LA-CHK-T294
kind: test
title: An aggregate without exactly one root is an aggregate-root error
parent: LA-CHK
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-CHK-UC24-R04, LA-CHK-DR181, LA-CHK-DR187]
---
Expects `aggregate-root` errors for an aggregate with two roots and one with none, and none for an aggregate with no entities.
