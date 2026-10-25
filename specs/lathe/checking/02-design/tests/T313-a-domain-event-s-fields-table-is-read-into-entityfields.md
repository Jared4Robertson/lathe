---
id: LA-CHK-T313
kind: test
title: A domain event's Fields table is read into entityFields
parent: LA-CHK
test_type: unit
run_by: lathe/test/events.test.ts
links:
  proves: [LA-CHK-UC26-R02, LA-CHK-DR200]
---
Expects an event's fields in table order, no fields for a table with the wrong columns or for no table, and no `entityFields` on kinds other than entity and domain event.
