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
The Nested map (`LA-EXP-DR62`): `nestedMap` lays out the whole tree of an index once, from one product's root as the Tree map has it (`mapRootOf`), and keeps it for that index. `layoutNested` gives every height level (a box's height from the leaves) one text scale (`settleLevelScale`, in the graph map module, `LA-EXP-C64`: the level's typical box size, each box sized at that scale, over a typical leaf's, at most 3 times the level below's), except that a root's children share the largest of their levels' scales and are sized again at it before the root, and works from the leaves up: each leaf is the least square that holds its label at its level's scale (`leafSide`), and each parent packs its children's squares in the tree's order in rows (`shelfPack`), trying a few row widths for the least square that holds its header band and that block inside its padding, its header's height at each width read from its label's wrapping steps (`wrapSteps`). Then, from the root down, it places each box and its children at their packed places below its header. Its nodes are the Tree map's (`PlacedMap`), with a header band's height and the tree's order added, so the camera, the minimap and the filters read both maps alike.
