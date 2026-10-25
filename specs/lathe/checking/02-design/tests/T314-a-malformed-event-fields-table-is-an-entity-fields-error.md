---
id: LA-CHK-T314
kind: test
title: A malformed event Fields table is an entity-fields error
parent: LA-CHK
test_type: unit
run_by: lathe/test/events.test.ts
links:
  proves: [LA-CHK-UC26-R02, LA-CHK-DR200]
---
Expects `entity-fields` errors naming the record as an event for a missing table, wrong columns, a row with no field name and a repeated field.
