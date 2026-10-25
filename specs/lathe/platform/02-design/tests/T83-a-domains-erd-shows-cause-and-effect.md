---
id: LA-PLT-T83
kind: test
title: A domain's ERD draws one dashed reacts-to line per aggregate pair and event, from the aggregate raising it to the one reacting, with the event's name as its label on hover
parent: LA-PLT
test_type: component
run_by: app/test/domain-events.test.tsx
links:
  proves: [LA-EXP-UC11-R08, LA-EXP-DR51, LA-PAT-APP-UX-R01, LA-PAT-APP-UX-R07]
---
Builds a domain's ERD and expects exactly one dashed line per aggregate's `reacts_to` link to another aggregate's event, both ways across a domain boundary, none for an aggregate's own event, the other domain's lines as context, and reacts-to lines fanned wider apart. Renders it and expects each line's hover label to be its event's name over a wider stroke, shown on the shared hover speed (none under reduced motion) and always by touch.
