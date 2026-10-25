---
id: LA-BRW-C290
kind: component
title: Graph tree
parent: LA-BRW-LAY12
component_type: module
file: app/src/graph/tree.ts
links:
  satisfies: [LA-BRW-DR300, LA-BRW-UC20-R01, LA-BRW-UC40-R01, LA-BRW-UC40-R03]
---
The graph's tree, built once per index from the one folder model the nav reads: a product's Shared folder, domains and kind groups; a domain's stages, their folders and the folders outside every stage; each folder's records, split into one group per kind when it mixes kinds the nav lists side by side, and kept as one list when it holds containers and then the records outside any; a record's children through one group per kind when they are of several kinds. Every stage, folder and group is a node with its address, label, count, members and owner.
