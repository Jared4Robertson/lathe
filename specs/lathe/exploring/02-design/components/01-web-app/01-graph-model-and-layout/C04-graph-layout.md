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
A trace box's size, 190 by 56 at text scale 1; `traceGrid`, which stacks a trace's columns of boxes in row order, each as tall as its wrapped label needs, centered on the center, since a trace is a chain and not part of the map; and `boxExit`, where a line leaves a box.
