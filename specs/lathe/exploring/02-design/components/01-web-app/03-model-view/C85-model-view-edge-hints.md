---
id: LA-EXP-C85
kind: component
title: Model view edge hints
parent: LA-EXP-LAY04
component_type: react component
file: app/src/model/hints.tsx
links:
  satisfies: [LA-EXP-UC11-R06]
  depends_on: [LA-EXP-C56, LA-EXP-C42]
---
The Model view's edge hints (`LA-EXP-C56`) over its React Flow canvas: the faded context boxes past each edge counted through React Flow's camera, drawn again only when a count changes, a click panning half a canvas that way with the shared motion.
