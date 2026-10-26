---
id: LA-EXP-C72
kind: component
title: Graph shapes
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/shapes.ts
links:
  satisfies: [LA-EXP-DR65, LA-EXP-DR61, LA-EXP-UC03-R04]
  depends_on: [LA-EXP-C04]
---
Each kind's shape (`LA-EXP-DR65`). `shapeOf` gives a kind's shape and mark (a group's folder, a plain box for a kind it does not know), `nodeShape` a node's by its ID, and `SHAPES` each shape's name for the key, how the stylesheet draws it (a clipped polygon, rounded corners, or a box with a drawing inside it) and the room it keeps clear of its label, which `wrapLabel` (`LA-EXP-C66`) keeps when it wraps and sizes a label and the stylesheet pads by. `outlinePolygon` and `shapeVars` give a Tree box's outline as a CSS polygon for its size and box scale, with its room and the notch a drawing inside lines up with; `outlineInset` is where the outline crosses a height, so a parent line meets it (`parentLine`, `LA-EXP-C64`). `shape-icons.tsx` draws each shape and mark small, before a Nested or Voronoi box's kind and ID line and in the key.
