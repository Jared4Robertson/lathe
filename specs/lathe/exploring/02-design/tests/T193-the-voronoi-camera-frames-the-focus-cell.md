---
id: LA-EXP-T193
kind: test
title: "In the Voronoi view the camera frames the focus cell, and the page draws each cell as its outline"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/camera.test.tsx
links:
  proves: [LA-EXP-UC03-R17, LA-EXP-DR63]
---
Frames the product, a domain and a use case in the Voronoi map on a canvas of 1000 by 800 and expects the focus's box centered, every drawn cell in view and at least 3 pixels across, a parent drawn before its children, the drawing within its budget and the focus drawn. On the page, with the Voronoi layout chosen, expects each cell clipped to its outline, drawn as a polygon with its label inside, and a click on a child gliding the camera to frame its cell.
