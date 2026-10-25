---
id: LA-BRW-C50
kind: component
title: Focus addresses and views in the link
parent: LA-BRW-LAY06
component_type: module
file: app/src/views/address.ts
links:
  satisfies: [LA-BRW-UC50-R01, LA-BRW-DR50, LA-BRW-DR52]
---
Builds and reads the one address of a record (`/records/<id>`), a group (`/records/<parent-id>/<kind>`), a product and a domain, the `view` query parameter, and where an old `/graph` address leads.
