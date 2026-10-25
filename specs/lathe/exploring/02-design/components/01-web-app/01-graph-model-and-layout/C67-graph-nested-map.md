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
The Nested map (`LA-EXP-DR62`): `nestedMap` lays out the whole tree of an index once, from one product's root as the Tree map has it (`mapRootOf`), and keeps it for that index. `layoutNested` counts the leaf records under each node, gives the world an area in proportion to them, and works level by level: it places the level's boxes with `squarify`, an ordered squarified treemap, finds the largest scale each box can hold its label at, wrapped on whole words (`fitScale`, a parent's within `headerRoom`), sets the level's one text scale (`levelScale`), and sizes each fitting parent's header band, its children going below it. Its nodes are the Tree map's (`PlacedMap`), with whether the label fits, a header band's height and the tree's order added, so the camera, the minimap and the filters read both maps alike.
