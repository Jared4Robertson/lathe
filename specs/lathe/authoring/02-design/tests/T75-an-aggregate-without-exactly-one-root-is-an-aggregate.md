---
id: LA-AUT-T75
kind: test
title: An aggregate without exactly one root is an aggregate-root error
parent: LA-AUT
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-AUT-UC11-R04, LA-AUT-DR51, LA-AUT-DR57]
---
Expects `aggregate-root` errors for an aggregate with two roots and one with none, and none for an aggregate with no entities.
