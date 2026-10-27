---
id: LA-EXP-C84
kind: component
title: Graph hit testing
parent: LA-EXP-LAY09
component_type: module
file: app/src/graph/hit.ts
links:
  satisfies: [LA-EXP-DR59, LA-EXP-DR60]
---
Finds the box under the pointer from the map's own outlines in map units (`hitPlate`, `inPlate`): a box's rectangle, a shape's polygon or rounded corners (`inPolygon`), a Voronoi cell's polygon, the last drawn first so a child drawn over its parent is found before it. `onScreen` culls a box wholly past an edge of the pane, through the camera relative to its center.
