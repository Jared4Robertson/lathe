---
id: LA-BRW-C23
kind: component
title: Graph routes and entry points
parent: LA-BRW
component_type: module
file: app/src/graph/route.tsx
links:
  satisfies: [LA-BRW-UC20-R07]
---
The `/graph/<id>` address, the Graph menu item and the "Open in graph" link that the record and domain pages show. Kept apart from the graph page so these load without React Flow and ELK.
