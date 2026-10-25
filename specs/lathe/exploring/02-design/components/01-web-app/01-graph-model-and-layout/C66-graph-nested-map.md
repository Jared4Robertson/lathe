---
id: LA-EXP-C66
kind: component
title: Graph nested map
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/nested.ts
links:
  satisfies: [LA-EXP-DR62, LA-EXP-UC03-R16]
  depends_on: [LA-EXP-C55, LA-EXP-C64]
---
The Nested map (`LA-EXP-DR62`): `nestedMap` lays out the whole tree of an index once, from one product's root as the Tree map has it (`mapRootOf`), and keeps it for that index. `layoutNested` counts the leaf records under each node, gives the world an area in proportion to them, and places each box's children inside it below its header band with `squarify`, an ordered squarified treemap. `nestedTextScale` fixes each box's text scale from its size and its label's width. Its nodes are the Tree map's (`PlacedMap`), with a header band's height and the tree's order added, so the camera, the minimap and the filters read both maps alike.
