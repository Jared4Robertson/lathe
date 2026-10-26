---
id: LA-EXP-T191
kind: test
title: "The Voronoi map holds each cell's children inside its outline, sized by the leaf records under them, the same every time"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/voronoi.test.ts
links:
  proves: [LA-EXP-DR64]
---
Lays out the test workspaces and synthetic trees and expects every cell convex with its node's box as its bounding box, every child's corners inside its parent's outline and below its header's cut, siblings never overlapping, a parent before its children in the keyboard's order, and the same roots and children as the Tree map; the product a flat-topped hexagon of the rounded leaves' area; at least 95% of cells within 5% of their share of their parent, and every rounded weight within 2%; the same tree giving an equal map, a record added under one parent, where the product's rounded leaves stay the same, leaving every cell outside that parent exactly in place, and one shape split the same way at any place and size; and the convex helpers insetting, cutting and crossing a square.
