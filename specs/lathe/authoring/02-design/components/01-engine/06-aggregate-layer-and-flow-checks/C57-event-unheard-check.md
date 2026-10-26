---
id: LA-AUT-C57
kind: component
title: Event unheard check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/73-event-unheard.sql
links:
  satisfies: [LA-AUT-UC12-R04, LA-AUT-DR66, LA-AUT-DR67]
  meets: [LA-STD-CODE-R01]
---
Warns of each domain event that no `reacts_to` link targets, from any record, saying this can be fine and naming what might react.
