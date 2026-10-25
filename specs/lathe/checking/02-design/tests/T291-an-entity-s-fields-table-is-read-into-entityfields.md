---
id: LA-CHK-T291
kind: test
title: An entity's Fields table is read into entityFields in table order
parent: LA-CHK
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-CHK-UC24-R02, LA-CHK-DR182]
---
Expects the rows of an entity's Fields table in order, with escaped pipes kept and short rows padded, and no table read from fenced code or a later heading. Other kinds have no `entityFields`.
