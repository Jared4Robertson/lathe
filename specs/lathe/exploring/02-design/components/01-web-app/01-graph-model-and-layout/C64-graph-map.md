---
id: LA-EXP-C64
kind: component
title: Graph map
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/map.ts
links:
  satisfies: [LA-EXP-DR04, LA-EXP-DR57, LA-EXP-DR58, LA-EXP-DR61, LA-EXP-UC03-R08, LA-EXP-UC04-R08]
  depends_on: [LA-EXP-C55, LA-EXP-C04, LA-EXP-C66]
---
One map per product (`LA-EXP-DR57`): `graphMap` lays out the tree under one root (`mapRootOf` finds the focus's product) once, as an icicle, and keeps it for that index and root. `layoutTree` walks the tree from its roots, sizes each level from the deepest up, settling together its one width, in proportion to its typical height within the caps (`typicalHeight`), its text scale, and its leaves' heights (a leaf a leaf high or as tall as its wrapped label, `LA-EXP-DR58`, `LA-EXP-C66`), a parent its children's stack with the level's gaps (a parent whose own label needs more passing the difference to its last leaf), and places every node, its children stacked from its top. For the Nested and Voronoi maps, `typicalSize` and `settleLevelScale` give each height level (a box's height from the leaves) its one text scale from its typical box size (`LA-EXP-DR62`, `LA-EXP-DR64`). `parentLine` and `linkEnds` say where a parent line and a cross-link meet their boxes, and `hexChamfer` and `outlineInset` where a domain's hexagon outline is (`LA-EXP-DR61`).
