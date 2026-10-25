---
id: LA-BRW-C21
kind: component
title: Graph layout
parent: LA-BRW-LAY12
component_type: module
file: app/src/graph/layout.ts
links:
  satisfies: [LA-BRW-DR20, LA-BRW-DR120, LA-BRW-UC20-R08]
---
Lays out a neighborhood with ELK's layered algorithm, one ELK partition per column, left to right (for the hierarchy and for a trace alike), forcing the model's row order within a column. Every link between two columns is laid out pointing right and links within one column are left out, so the layout graph has no cycle and every graph is drawn in columns; there is no other layout. The column and row of each node come from the graph model.
