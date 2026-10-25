---
id: LA-BRW-C293
kind: component
title: Domain events section
parent: LA-BRW-LAY11
component_type: react component
file: app/src/specs/DomainEvents.tsx
links:
  satisfies: [LA-BRW-UC118-R06, LA-BRW-DR160, LA-PAT-APP-UX-R05]
  depends_on: [LA-BRW-C292, LA-BRW-C33]
---
`DomainEvents` draws an aggregate's "Domain events" section on its wiki page, after the body: one whole-row link per event that says, in the relations' labels, which entity raises it and how many records react to it. The record content leaves the events out of the aggregate's other children.
