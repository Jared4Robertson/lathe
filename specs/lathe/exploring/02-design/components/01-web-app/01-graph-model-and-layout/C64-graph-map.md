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
One map per product (`LA-EXP-DR57`): `graphMap` lays out the tree under one root (`mapRootOf` finds the focus's product) once, as an icicle, and keeps it for that index and root. `layoutTree` walks the tree from its roots, sets each depth column's place and width as fixed fractions of the product's box (`MAP_SIZE`, `ROOT_WIDTH`, `COLUMN_RATIO`, `COLUMN_GAP_SHARE`), and from the roots down splits each parent's height equally among its children, a gap apart (`ROW_GAP_SHARE`), giving each group of siblings one text scale, their column's width over `TEXT_SIZE` (`sizeText`) or the largest at which every sibling's label fits its box (`largestFit`, `LA-EXP-C66`), and each node its centered lines (`LA-EXP-DR58`). The same constants and `sizeText` serve the Nested and Voronoi maps. `parentLine` and `linkEnds` say where a parent line and a cross-link meet their boxes, a parent line meeting each box's shape where `outlineInset` (`LA-EXP-C72`) says its outline is (`LA-EXP-DR61`, `LA-EXP-DR65`).
