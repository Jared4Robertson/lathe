---
id: LA-EXP-T212
kind: test
title: "Only boxes on screen are drawn, placed relative to the camera's center"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/canvas.test.tsx
links:
  proves: [LA-EXP-DR59, LA-EXP-DR60]
---
Expects a box on screen drawn and a box wholly past an edge culled, a far box coming into view when the camera zooms out about the same center, and a tiny box deep in a very large map, at a very deep zoom, placed as exactly as one near the origin.
