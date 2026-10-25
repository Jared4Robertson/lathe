---
id: LA-EXP-C04
kind: component
title: Graph sizes and a trace's layout
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/layout.ts
links:
  satisfies: [LA-EXP-UC03-R08, LA-EXP-DR58]
---
A leaf's size, shared by the map and a trace; `traceGrid`, which stacks a trace's columns of leaf boxes in row order, each as tall as its wrapped label needs, centered on the center, since a trace is a chain and not part of the map; `boxExit`, where a line leaves a box; and `contentScale`, a node's box scale for its border and outline, the smaller of its width and height over a leaf's, never below 1 (`LA-EXP-DR58`).
