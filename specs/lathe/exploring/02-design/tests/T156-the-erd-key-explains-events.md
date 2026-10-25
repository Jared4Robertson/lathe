---
id: LA-EXP-T156
kind: test
title: The ERD's key explains the event pill, the raised-by line and the dashed reacts-to line in the relations' own words, and keeps its one height
parent: LA-EXP
test_type: component
run_by: app/test/domain-events.test.tsx
links:
  proves: [LA-EXP-UC11-R09]
---
Opens an aggregate's and a domain's ERD and expects the key's Domain events list to explain the pill, "Raised by" and "Reacts to" (from the meta-model's labels) as each diagram draws them, an event's own key to say "This event", and the key's fixed height in the stylesheet.
