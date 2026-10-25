---
id: LA-EXP-C58
kind: component
title: Domain events section
parent: LA-EXP-LAY06
component_type: react component
file: app/src/specs/DomainEvents.tsx
links:
  satisfies: [LA-TRC-UC14-R06, LA-EXP-DR36, LA-PAT-APP-UX-R05]
  depends_on: [LA-EXP-C57, LA-EXP-C08]
---
`DomainEvents` draws an aggregate's "Domain events" section on its wiki page, after the body: one whole-row link per event that says, in the relations' labels, which entity raises it and how many records react to it. The record content leaves the events out of the aggregate's other children.
