---
id: LA-PLT-T86
kind: test
title: An aggregate's page lists its domain events titled "Domain events", each row a whole link saying what raises it and how many react; an event's page shows its Fields table, "Raised by" and "Reacted to by", and a reacting record shows "Reacts to"
parent: LA-PLT
test_type: component
run_by: app/test/domain-events.test.tsx
links:
  proves: [LA-TRC-UC14-R06, LA-EXP-DR36, LA-PAT-APP-UX-R05]
---
Opens an aggregate's page and expects its Domain events list, one link per row with "Raised by" and "Reacted to by" counts, and the events left out of its Entities list; follows a row to the event and expects its Fields table and its Traceability's "Raised by" and "Reacted to by" groups with no relation codes; opens a reacting aggregate and expects "Reacts to".
