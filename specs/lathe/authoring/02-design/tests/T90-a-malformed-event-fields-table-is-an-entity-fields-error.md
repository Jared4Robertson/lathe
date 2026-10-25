---
id: LA-AUT-T90
kind: test
title: A malformed event Fields table is an entity-fields error
parent: LA-AUT
test_type: unit
run_by: lathe/test/events.test.ts
links:
  proves: [LA-AUT-UC12-R02, LA-AUT-DR65]
---
Expects `entity-fields` errors naming the record as an event for a missing table, wrong columns, a row with no field name and a repeated field.
