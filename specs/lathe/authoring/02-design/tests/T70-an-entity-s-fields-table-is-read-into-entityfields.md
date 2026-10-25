---
id: LA-AUT-T70
kind: test
title: An entity's Fields table is read into entityFields in table order
parent: LA-AUT
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-AUT-UC10-R02, LA-AUT-DR52]
---
Expects the rows of an entity's Fields table in order, with escaped pipes kept and short rows padded, and no table read from fenced code or a later heading. Other kinds have no `entityFields`.
