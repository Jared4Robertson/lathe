---
id: LA-BRW-C213
kind: component
title: Tap to open on a canvas
parent: LA-BRW-LAY13
component_type: module
file: app/src/graph/touch.tsx
links:
  satisfies: [LA-BRW-UC116-R07, LA-BRW-DR222]
---
`useTapToOpen`: on a click from a finger or a pen (or, when the event does not say, on a touch screen) a node is selected first, outlined (`is-armed`) and named by `TapCard` at the bottom of the canvas with an Open chip; a second tap or the chip opens it, and a tap on the canvas lets go. The graph and the ERD both use it; a mouse click opens at once.
