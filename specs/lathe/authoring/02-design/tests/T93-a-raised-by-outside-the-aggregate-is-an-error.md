---
id: LA-AUT-T93
kind: test
title: A raised_by outside the aggregate is a raised-by-outside-aggregate error
parent: LA-AUT
test_type: unit
run_by: lathe/test/events.test.ts
links:
  proves: [LA-AUT-UC13-R03, LA-AUT-DR64]
---
Expects one `raised-by-outside-aggregate` error for an event raised by another aggregate's entity, and none for an event with no `raised_by`, a target that does not exist or is not an entity, or a duplicated target with a copy in the event's aggregate.
