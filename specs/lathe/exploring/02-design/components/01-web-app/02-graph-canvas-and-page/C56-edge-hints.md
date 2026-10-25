---
id: LA-EXP-C56
kind: component
title: Edge hints
parent: LA-EXP-LAY03
component_type: module
file: app/src/graph/hints.tsx
links:
  satisfies: [LA-EXP-UC03-R12, LA-EXP-UC11-R06]
---
The chips at a canvas's edges that count the boxes of interest past each edge and follow the camera: in the graph, the records the center links to (`LA-EXP-UC03-R12`), a click gliding the nearest of them into view; in the Model view, its faded context boxes, a click panning half a canvas that way with the shared motion.
