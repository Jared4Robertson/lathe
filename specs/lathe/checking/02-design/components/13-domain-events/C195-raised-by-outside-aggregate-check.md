---
id: LA-CHK-C195
kind: component
title: Raised by outside aggregate check
parent: LA-CHK-LAY13
component_type: sql check
file: lathe/checks/75-raised-by-outside-aggregate.sql
links:
  satisfies: [LA-CHK-UC26-R03, LA-CHK-DR199]
---
Reports each `raised_by` whose target entity sits in another aggregate than the event; a duplicated target is reported only when no copy shares the event's aggregate.
