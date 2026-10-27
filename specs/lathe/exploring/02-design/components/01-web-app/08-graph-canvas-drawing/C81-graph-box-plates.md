---
id: LA-EXP-C81
kind: component
title: Graph box plates
parent: LA-EXP-LAY09
component_type: module
file: app/src/graph/plate.ts
links:
  satisfies: [LA-EXP-DR58, LA-EXP-DR60, LA-EXP-DR62, LA-EXP-DR64, LA-EXP-DR65, LA-PAT-APP-UX-R12]
  depends_on: [LA-EXP-C66, LA-EXP-C72, LA-EXP-C64, LA-EXP-C67, LA-EXP-C68]
---
`plateOf` makes a box's plate once per map and node, in map units: its outline (its kind's shape in the Tree view and a trace, a box in the Nested view, its polygon in the Voronoi view), its border and look's roles, and its label placed in it as the map broke it: each line's place, font size (its face's size times the box's text scale) and width, the marks before its kind and ID line, and its problem badges where they sit. Nothing in a plate depends on the camera. `plateName` is a box's accessible name, and `plateTip` its tooltip.
