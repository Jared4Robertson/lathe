---
id: LA-EXP-T211
kind: test
title: "The pointer finds the deepest box under it from the map's outlines"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/canvas.test.tsx
links:
  proves: [LA-EXP-DR59]
---
Expects a point inside a polygon found and one outside not; a rounded box's corner outside its curve not its box; in each layout the middle of every box's label to find that box, not its parent drawn under it; nothing far outside the map; and a hexagon's cut corner outside the domain.
