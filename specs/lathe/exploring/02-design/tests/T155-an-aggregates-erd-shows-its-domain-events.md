---
id: LA-EXP-T155
kind: test
title: An aggregate's ERD draws each of its domain events as a spark pill with a short line from the entity raising it, and the aggregates reacting to it as faded context at the end of a dashed reacts-to line
parent: LA-EXP
test_type: component
run_by: app/test/domain-events.test.tsx
links:
  proves: [LA-EXP-UC11-R07, LA-EXP-DR52]
---
Builds an aggregate's ERD with three events (one raised by time passing) and expects a pill per event with its fields, a plain-ended line from each raising entity, a dashed line with an arrow to each reacting aggregate (faded; another domain's gray and named; the aggregate's reaction to its own event and a use case's drawing nothing), the layering that keeps the raised-by lines short, and an event's page scoping to its aggregate's ERD with its pill picked out. Renders the Model view and expects the pills, their accessible names, the lines' tooltips, a click on a pill going to the event, the event's own page in the Model view with its pill picked out, and the spark tokens in the stylesheet.
