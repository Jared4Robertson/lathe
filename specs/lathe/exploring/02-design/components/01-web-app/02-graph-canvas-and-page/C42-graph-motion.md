---
id: LA-EXP-C42
kind: component
title: Graph motion
parent: LA-EXP-LAY03
component_type: module
file: app/src/graph/motion.ts
links:
  satisfies: [LA-EXP-DR31, LA-PAT-APP-UX-R04]
---
The shared motion, read from the stylesheet's `--motion-speed` and `--motion-ease` tokens, with `prefers-reduced-motion` turning it off: `cubicBezier`, `parseDuration` and `parseEase` follow the stylesheet's curve in JS, and `readMotion` gives the duration and easing the graph's camera glides on, as do the Model view's camera and the side bar's Outline.
