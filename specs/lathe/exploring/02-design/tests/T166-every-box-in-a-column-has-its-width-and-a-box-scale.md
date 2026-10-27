---
id: LA-EXP-T166
kind: test
title: Every box in a column has its width, a fixed fraction of the map, and a box's scale is the smaller of its width and height over a trace box's
parent: LA-EXP
test_type: unit
run_by: app/test/graph/map.test.ts
links:
  proves: [LA-EXP-DR58]
---
Checks the box scale of a trace box (1), of boxes shorter or narrower than one (below 1, however small) and of larger ones, and in the Tree maps of three workspaces and three synthetic trees every column 0.4 times as wide as the one before from the product's, with a gap before it of 0.15 times its width, every box in a column at its place and width, and the map as wide as its columns.
