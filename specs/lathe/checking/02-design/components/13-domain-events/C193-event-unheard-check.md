---
id: LA-CHK-C193
kind: component
title: Event unheard check
parent: LA-CHK-LAY13
component_type: sql check
file: lathe/checks/73-event-unheard.sql
links:
  satisfies: [LA-CHK-UC26-R04, LA-CHK-DR201, LA-CHK-DR202]
---
Warns of each domain event that no `reacts_to` link targets, from any record, saying this can be fine and naming what might react.
