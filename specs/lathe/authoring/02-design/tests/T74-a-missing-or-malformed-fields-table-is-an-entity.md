---
id: LA-AUT-T74
kind: test
title: A missing or malformed Fields table is an entity-fields error
parent: LA-AUT
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-AUT-UC10-R05, LA-AUT-DR52, LA-AUT-DR53, LA-AUT-DR57]
---
Expects `entity-fields` errors for a missing heading, a heading with no table, wrong columns (reported alone), a field named three ways, and a row with no field name.
