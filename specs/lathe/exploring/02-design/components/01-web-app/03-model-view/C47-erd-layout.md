---
id: LA-EXP-C47
kind: component
title: ERD layout
parent: LA-EXP-LAY04
component_type: module
file: app/src/model/layout.ts
links:
  satisfies: [LA-EXP-UC11-R02, LA-EXP-UC11-R03, LA-EXP-UC11-R07]
  depends_on: [LA-EXP-C46]
---
Lays out an ERD left to right along its lines with ELK's layered algorithm, the diagram's own boxes first in model order, so the same diagram always gets the same picture. With domain events, each box goes in the first layer its lines allow, so an event sits right after the entity raising it.
