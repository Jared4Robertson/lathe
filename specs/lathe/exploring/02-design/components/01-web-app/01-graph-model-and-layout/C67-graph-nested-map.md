---
id: LA-EXP-C67
kind: component
title: Graph nested map
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/nested.ts
links:
  satisfies: [LA-EXP-DR62, LA-EXP-UC03-R16]
  depends_on: [LA-EXP-C55, LA-EXP-C64, LA-EXP-C66]
---
The Nested map (`LA-EXP-DR62`): `nestedMap` lays out the whole tree of an index once, from one product's root as the Tree map has it (`mapRootOf`), and keeps it for that index. `layoutNested` works from the product's fixed square down: for each group of siblings it sets one text scale, their side's share (`sizeText`) or the largest at which every sibling's label fits (`largestFit`: a leaf's in its square, a parent's in a header band at most `HEADER_SHARE` of it), and one header band, the tallest of their labels; then it lays each parent's children out below its header, inside its padding, as a grid of equal squares in the tree's order (`gridOf`, the column count that makes them largest). Its nodes are the Tree map's (`PlacedMap`), with a header band's height and the tree's order added, so the camera, the minimap and the filters read both maps alike.
