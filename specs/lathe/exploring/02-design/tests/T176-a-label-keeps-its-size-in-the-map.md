---
id: LA-EXP-T176
kind: test
title: "A label keeps its size in the map: its text scale is its level's width over a leaf's, and the camera never changes it"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/map.test.ts
links:
  proves: [LA-EXP-DR58, LA-EXP-DR60]
---
Checks the text scale of a leaf-wide level (1) and of a level ten leaves wide (10), and that at a quarter, one and four times a domain's framing zoom every drawn box carries no text size of its own: the camera never changes a label.
