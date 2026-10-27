---
id: LA-EXP-T176
kind: test
title: "A label keeps its size in the map: its text scale is the map's, and the camera never changes it"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/map.test.ts
links:
  proves: [LA-EXP-DR58, LA-EXP-DR60]
---
Checks every box's text scale is at most its column's width over 400, set by the map, and that at a quarter, one and four times a domain's framing zoom every drawn box carries no text size of its own: the camera never changes a label.
