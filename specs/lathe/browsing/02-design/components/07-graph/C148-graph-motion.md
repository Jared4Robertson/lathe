---
id: LA-BRW-C148
kind: component
title: Graph motion
parent: LA-BRW-LAY07
component_type: module
file: app/src/graph/motion.ts
links:
  satisfies: [LA-BRW-UC20-R09, LA-BRW-DR147, LA-BRW-DR148]
---
The shared motion, read from the stylesheet's `--motion-speed` and `--motion-ease` tokens, with `prefers-reduced-motion` turning it off; and the edge tween. `tweenEdge` moves the two box centers an edge joins along the same easing as the nodes' transform transition and draws the line from box edge to box edge, so its ends stay on the boxes. `edgeMove` says where a persisting, new or leaving edge starts and ends: moving, fading in or fading out. `transitionProgress` reads the nodes' own transition clock, so an edge moves in step with them. The graph page paints each frame straight to the edge's line and label.
