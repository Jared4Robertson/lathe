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
Each kind's shape (`LA-EXP-DR65`). `shapeOf` gives a kind's shape and mark (a group's folder, a plain box for a kind it does not know), `nodeShape` a node's by its ID, and `SHAPES` each shape's name for the key, how the canvas draws it (a polygon, rounded corners, or a box with a drawing inside it) and the room it keeps clear of its label, which `wrapLabel` (`LA-EXP-C66`) keeps when it wraps and sizes a label and the box's plate (`LA-EXP-C81`) pads by. `outlineOf` gives a box's outline for its size and box scale (a polygon's corners in map units, or its corner radii), and `notchOf` the notch a drawing inside lines up with; `outlineInset` is where the outline crosses a height, so a parent line meets it (`parentLine`, `LA-EXP-C64`). `shape-icons.tsx` holds each shape's and mark's small drawing, which the canvas draws before a Nested or Voronoi box's kind and ID line and the key shows.
