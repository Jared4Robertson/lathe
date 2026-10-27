---
id: LA-EXP-C51
kind: component
title: Tap to open on a canvas
parent: LA-EXP-LAY03
component_type: module
file: app/src/graph/touch.tsx
links:
  satisfies: [LA-PLT-UC08-R07, LA-EXP-DR42]
---
`useTapToOpen`: on a click from a finger or a pen (or, when the event does not say, on a touch screen) a node is selected first, outlined (its element with its `data-id` takes `is-armed`: the Model view's node, the graph's box in its keyboard layer, which the graph's canvas also draws as selected) and named by `TapCard` at the bottom of the canvas with an Open chip; a second tap or the chip opens it, and a tap on the canvas lets go. The graph and the ERD both use it; a mouse click opens at once.
