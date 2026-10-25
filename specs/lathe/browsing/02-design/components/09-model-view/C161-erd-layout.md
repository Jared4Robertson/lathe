---
id: LA-BRW-C161
kind: component
title: ERD layout
parent: LA-BRW-LAY09
component_type: module
file: app/src/model/layout.ts
links:
  satisfies: [LA-BRW-UC113-R02, LA-BRW-UC113-R03, LA-BRW-UC113-R07]
  depends_on: [LA-BRW-C160]
---
Lays out an ERD left to right along its lines with ELK's layered algorithm, the diagram's own boxes first in model order, so the same diagram always gets the same picture. With domain events, each box goes in the first layer its lines allow, so an event sits right after the entity raising it.
