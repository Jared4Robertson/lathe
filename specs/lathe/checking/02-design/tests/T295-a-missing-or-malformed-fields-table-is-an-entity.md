---
id: LA-CHK-T295
kind: test
title: A missing or malformed Fields table is an entity-fields error
parent: LA-CHK
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-CHK-UC24-R05, LA-CHK-DR182, LA-CHK-DR183, LA-CHK-DR187]
---
Expects `entity-fields` errors for a missing heading, a heading with no table, wrong columns (reported alone), a field named three ways, and a row with no field name.
