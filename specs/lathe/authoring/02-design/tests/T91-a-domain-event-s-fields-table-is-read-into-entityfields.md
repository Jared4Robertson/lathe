---
id: LA-AUT-T91
kind: test
title: A domain event's Fields table is read into entityFields
parent: LA-AUT
test_type: unit
run_by: lathe/test/events.test.ts
links:
  proves: [LA-AUT-UC13-R02, LA-AUT-DR65]
---
Expects an event's fields in table order, no fields for a table with the wrong columns or for no table, and no `entityFields` on kinds other than entity and domain event.
