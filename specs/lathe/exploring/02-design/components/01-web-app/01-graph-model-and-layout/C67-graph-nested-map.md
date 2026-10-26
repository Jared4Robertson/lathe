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
The Nested map (`LA-EXP-DR62`): `nestedMap` lays out the whole tree of an index once, from one product's root as the Tree map has it (`mapRootOf`), and keeps it for that index. `layoutNested` counts the leaf records under each node, gives every height level (a box's height from the leaves) one text scale (`settleLevelScale`, in the graph map module, `LA-EXP-C64`: the level's typical box size, planned at the larger of its records and its least area, over a leaf's, at most 3 times the level below's) and works from the leaves up: each leaf's least area is its label's least box at its level's scale (`labelBox`, wrapped on whole words toward a 3 by 2 shape), each parent's its header at its level's scale over its children packed. Then, from the root down, it shares each box's room among its children (`shareRoom`, each the larger of its share by records and its least area) and places them with `squarify`, an ordered squarified treemap, a parent's header band its label's height, its children below it. A box whose label does not fit the cell it got has its least area grown and the map is laid out again, a bounded number of passes. Its nodes are the Tree map's (`PlacedMap`), with a header band's height and the tree's order added, so the camera, the minimap and the filters read both maps alike.
