---
id: LA-BRW-C42
kind: component
title: Graph group addresses
parent: LA-BRW-LAY14
component_type: module
file: app/src/views/address.ts
links:
  satisfies: [LA-BRW-UC40-R03]
---
Builds and reads a group's address, `/records/<parent-id>/<kind>`, alongside `/records/<record-id>` for a record, and leads the older `/graph/<parent-id>/<kind>` there in the Graph view.
