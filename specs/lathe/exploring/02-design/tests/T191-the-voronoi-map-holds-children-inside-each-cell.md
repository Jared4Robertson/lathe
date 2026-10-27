---
id: LA-EXP-T191
kind: test
title: The Voronoi map holds each cell's children inside its outline, equal-area cells top-down from the product's fixed hexagon, the same every time
parent: LA-EXP
test_type: unit
run_by: app/test/graph/voronoi.test.ts
links:
  proves: [LA-EXP-DR64]
---
Lays out the test workspaces and synthetic trees and expects every cell convex with its node's box as its bounding box, every child's corners inside its parent's outline and below its header's cut, siblings never overlapping, a parent before its children in the keyboard's order, and the same roots and children as the Tree map; the product a flat-topped hexagon of the fixed area, as wide as the product box; at least 95% of cells within 5% of their siblings' mean area, whatever the records under them; the same tree giving an equal map, a record added under one parent leaving every cell outside it, and that parent's own, exactly in place, and one shape split the same way at any place and size; and the convex helpers insetting, cutting and crossing a square.
