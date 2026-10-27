---
id: LA-EXP-C80
kind: component
title: Graph painter
parent: LA-EXP-LAY09
component_type: module
file: app/src/graph/paint.ts
links:
  satisfies: [LA-EXP-DR59, LA-EXP-DR60, LA-EXP-DR61, LA-EXP-DR65, LA-EXP-UC03-R10, LA-PAT-APP-UX-R12]
  depends_on: [LA-EXP-C81, LA-EXP-C82, LA-EXP-C83, LA-EXP-C84, LA-EXP-C72]
---
Draws one frame of the graph on its canvas, in screen pixels at the screen's pixel ratio: the dots behind the map, bars, parent lines and links (dashed curves with their arrows), then each box on screen (its fill, its edge or ring for the focus, the hover, the keyboard's focus ring and a tap's selection, its shape's drawing inside, its marks, its label's lines at their map size times the zoom, its badges), the links' words, and the vignette cut out at the edges. Every point is placed relative to the camera's center in double precision, with no transform but the pixel ratio. The hover spotlight dims the rest a step, fading on the shared motion. A line under `TEXT_BAR_PX` on screen is drawn as a faint bar. `boxLook` and `boxColors` give a box's look and colors, `lineStroke` a line's.
