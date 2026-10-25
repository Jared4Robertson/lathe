---
id: LA-BRW-C23
kind: component
title: Graph routes and entry points
parent: LA-BRW-LAY07
component_type: module
file: app/src/views/address.ts
links:
  satisfies: [LA-BRW-UC20-R07]
---
The entry points to the graph: every record, group, product and domain page's Graph view (the nav has no Graph item), and where the older `/graph/<id>` addresses lead. Kept apart from the graph page so these load without React Flow and ELK.
