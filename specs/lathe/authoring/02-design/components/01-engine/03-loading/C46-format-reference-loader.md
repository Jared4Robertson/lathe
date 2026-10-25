---
id: LA-AUT-C46
kind: component
title: Format reference loader
parent: LA-AUT-LAY04
component_type: module
file: lathe/src/index.ts
links:
  satisfies: [LA-AUT-UC11-R02, LA-AUT-UC11-R03]
  depends_on: [LA-AUT-C06, LA-CHK-C12, LA-AUT-C45, LA-CHK-C17]
  reacts_to: [LA-AUT-EV03, LA-CHK-EV01]
---
`formatReference(root)` merges the product's meta-model as the workspace loader does, reads `ids.csv`, works out each kind's children, and reads the header of every check that runs: Lathe's in file order, the engine's own, then the product's. It reads no records.
