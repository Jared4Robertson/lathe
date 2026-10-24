---
id: LA-BRW-C23
kind: component
title: Graph routes and entry points
parent: LA-BRW
component_type: module
file: app/src/views/address.ts
links:
  satisfies: [LA-BRW-UC20-R07]
---
The entry points to the graph: every record, group, product and domain page's Graph view, the nav's Graph item (the current page in the Graph view), and where the older `/graph/<id>` addresses lead. Kept apart from the graph page so these load without React Flow and ELK.
