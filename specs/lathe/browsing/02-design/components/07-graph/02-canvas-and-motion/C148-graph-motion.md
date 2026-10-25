---
id: LA-BRW-C148
kind: component
title: Graph motion
parent: LA-BRW-LAY13
component_type: module
file: app/src/graph/motion.ts
links:
  satisfies: [LA-BRW-UC20-R09, LA-BRW-DR147, LA-BRW-DR148, LA-PAT-APP-UX-R11]
---
The shared motion, read from the stylesheet's `--motion-speed` and `--motion-ease` tokens, with `prefers-reduced-motion` turning it off; and the edge tween. `tweenEdge` moves the two box centers and heights an edge joins along the same easing as the nodes' transform and height transitions and draws the line from box edge to box edge, so its ends stay on the boxes; a tree connector of the icicle is drawn level, from the parent's right edge to the child's left edge at the child's middle (`LA-BRW-DR330`). `edgeMove` says where a persisting, new or leaving edge starts and ends: moving, fading in or fading out. `canvasProgress` reads the nodes' own transition clock once a frame for the whole canvas (every node of a re-center shares one clock), so every edge moves in step with them without each edge reading it, which made a frame of a 200-box re-center take 480 ms (`LA-PAT-APP-UX-R11`); `transitionProgress` reads it from given elements. The graph page paints each frame straight to the edge's line and label.
