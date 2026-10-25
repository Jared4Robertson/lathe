---
id: LA-EXP-C64
kind: component
title: Graph map
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/map.ts
links:
  satisfies: [LA-EXP-DR04, LA-EXP-DR57, LA-EXP-DR58, LA-EXP-DR61, LA-EXP-UC03-R08, LA-EXP-UC04-R08]
  depends_on: [LA-EXP-C55, LA-EXP-C04]
---
The one map (`LA-EXP-DR57`): `graphMap` lays out the whole tree of an index once, as an icicle, and keeps it for that index. `layoutTree` walks the tree from its roots, sizes each level from the deepest up (a leaf one fixed size, a parent its children's stack with the level's gaps), gives each level one width from its typical height within the caps (`typicalHeight`, `LA-EXP-DR58`), and places every node, its children stacked from its top. `parentLine` and `linkEnds` say where a parent line and a cross-link meet their boxes, and `hexChamfer` and `outlineInset` where a domain's hexagon outline is (`LA-EXP-DR61`).
