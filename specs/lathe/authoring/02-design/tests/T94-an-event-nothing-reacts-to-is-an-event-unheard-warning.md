---
id: LA-AUT-T94
kind: test
title: An event nothing reacts to is an event-unheard warning
parent: LA-AUT
test_type: unit
run_by: lathe/test/events.test.ts
links:
  proves: [LA-AUT-UC13-R04, LA-AUT-DR66, LA-AUT-DR67]
---
Expects `event-unheard` warnings for exactly the events that no `reacts_to` link targets, none for events heard by an aggregate, a use case or another record, and a message that says this can be fine.
