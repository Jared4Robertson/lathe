---
id: LA-AUT-C59
kind: component
title: Raised by outside aggregate check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/75-raised-by-outside-aggregate.sql
links:
  satisfies: [LA-AUT-UC12-R03, LA-AUT-DR64]
---
Reports each `raised_by` whose target entity sits in another aggregate than the event; a duplicated target is reported only when no copy shares the event's aggregate.
