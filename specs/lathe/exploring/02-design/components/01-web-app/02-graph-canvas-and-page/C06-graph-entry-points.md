---
id: LA-EXP-C06
kind: component
title: Graph routes and entry points
parent: LA-EXP-LAY03
component_type: module
file: app/src/views/address.ts
links:
  satisfies: [LA-EXP-UC03-R07]
---
The entry points to the graph: every record, group, product and domain page's Graph view (the nav has no Graph item), and where the older `/graph/<id>` addresses lead. Kept apart from the graph page so these load without React Flow.
