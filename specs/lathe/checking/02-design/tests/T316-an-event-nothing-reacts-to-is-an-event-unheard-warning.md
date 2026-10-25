---
id: LA-CHK-T316
kind: test
title: An event nothing reacts to is an event-unheard warning
parent: LA-CHK
test_type: unit
run_by: lathe/test/events.test.ts
links:
  proves: [LA-CHK-UC26-R04, LA-CHK-DR201, LA-CHK-DR202]
---
Expects `event-unheard` warnings for exactly the events that no `reacts_to` link targets, none for events heard by an aggregate, a use case or another record, and a message that says this can be fine.
