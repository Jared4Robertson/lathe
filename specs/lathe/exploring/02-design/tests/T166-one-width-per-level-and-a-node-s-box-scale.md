---
id: LA-EXP-T166
kind: test
title: "Every node in a level has its width, and a node's box scale is the smaller of its width and height over a leaf's"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/map.test.ts
links:
  proves: [LA-EXP-DR58]
---
Checks the box scale, never below 1, and in the maps of three workspaces and two large synthetic trees one width per level, never under its proportional width; a proportional width never narrower than the level below's nor wider than the cap, in proportion to the level's typical height where no cap applies; and in the synthetic trees, whose labels are a leaf wide, each level as wide as its tallest box's label and a leaf level a leaf's width.
