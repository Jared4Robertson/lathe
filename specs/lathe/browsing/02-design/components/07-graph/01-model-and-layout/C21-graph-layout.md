---
id: LA-BRW-C21
kind: component
title: Graph layout
parent: LA-BRW-LAY12
component_type: module
file: app/src/graph/layout.ts
links:
  satisfies: [LA-BRW-DR20, LA-BRW-DR120, LA-BRW-UC20-R08, LA-BRW-DR330, LA-BRW-DR331, LA-BRW-UC40-R08]
---
Lays out a picture in columns, left to right, directly and on the main thread: both layouts are deterministic and take well under a millisecond, so there is no layout engine. `icicle` lays out the hierarchy as an icicle (`LA-BRW-DR330`): each node with children drawn in the next column is as tall as their stack, gaps included, and the stack starts at its top edge; a leaf, a chip and a node whose children are not drawn are one node high. The center's tree goes first; any other tree (a record the Links switch brings) goes in the nearest free place in its columns to the node it was reached from. `traceGrid` stacks a trace's columns of leaf-high boxes, centered on the center. Links play no part in either, so every graph is drawn in columns. Both return each node's top-left corner and height, the center's middle at the origin; the column and row of each node come from the graph model. `drawnTree` and `isTreeEdge` say which parent lines are the icicle's level connectors, and `contentScale` gives a tall node's content scale from its height and text (`LA-BRW-DR331`).
