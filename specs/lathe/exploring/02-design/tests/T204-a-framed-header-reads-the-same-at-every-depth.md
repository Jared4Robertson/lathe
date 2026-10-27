---
id: LA-EXP-T204
kind: test
title: "A framed box's header reads at the same size on screen at every depth, and the camera can frame the deepest leaf"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/readable.test.ts
links:
  proves: [LA-EXP-DR58, LA-EXP-DR59]
---
Loads the repo's own specs (Lathe and the Tool Library) and, in each layout, frames every box at depth 1 in a 770 by 640 pane with the real camera, and expects every frame within the camera's zoom limits; the framed title's median size on screen at each depth exactly the same at every depth in Nested and in the Tree (of each parent but the product whose text its column sets and whose frame its columns' width sets), within 40% across depths in Voronoi, and between 9 and 20 pixels; and the smallest box of each map framed short of the zoom limit.
