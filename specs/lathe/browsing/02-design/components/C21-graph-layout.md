---
id: LA-BRW-C21
kind: component
title: Graph layout
parent: LA-BRW
component_type: module
file: app/src/graph/layout.ts
links:
  satisfies: [LA-BRW-DR20, LA-BRW-UC20-R08]
---
Lays out a neighbourhood with ELK's layered algorithm, one ELK partition per tier, top to bottom (or left to right for a trace), keeping the model's order within a tier. Links within a tier do not shape the layout; when they form a cycle it falls back to ELK's radial algorithm around the focus and reports the cycle. The tier of each kind comes from the graph model.
