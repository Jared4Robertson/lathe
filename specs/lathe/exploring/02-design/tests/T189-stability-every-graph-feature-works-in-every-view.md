---
id: LA-EXP-T189
kind: test
title: "Stability: every graph feature works the same in the Tree, Nested and Voronoi views"
parent: LA-EXP
test_type: acceptance
run_by: app/stability/graph.spec.ts
links:
  proves: [LA-EXP-UC03-R16, LA-EXP-UC03-R17, LA-EXP-UC03-R06, LA-EXP-UC03-R10]
---
Runs one table of the graph's features in each view: the Layout switch and its `v` command, a click to focus, Enter on a focused box, Tab and arrow keys with a visible focus ring, the step keys, `.` framing the focus, depth 1 to 3, Links, a hidden kind keeping its space, the minimap, the trail, Back and Forward, the hover spotlight with Details following it, and the side bar's Outline; in the Nested view, every drawn child inside its parent's box on screen and the view kept across a reload of the tab; and in the Voronoi view, every drawn cell clipped to its outline, inside its parent's box on screen.
