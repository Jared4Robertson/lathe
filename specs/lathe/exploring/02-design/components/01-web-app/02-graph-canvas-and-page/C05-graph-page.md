---
id: LA-EXP-C05
kind: component
title: Graph page
parent: LA-EXP-LAY03
component_type: react component
file: app/src/graph/GraphPage.tsx
links:
  implements: [LA-EXP-V04]
  satisfies: [LA-EXP-UC03-R02, LA-EXP-UC03-R03, LA-EXP-UC03-R04, LA-EXP-UC03-R05, LA-EXP-UC03-R06, LA-EXP-UC03-R08, LA-EXP-UC03-R09, LA-TRC-UC10-R01, LA-TRC-UC10-R02, LA-EXP-UC03-R10, LA-EXP-UC03-R12, LA-EXP-UC03-R14, LA-EXP-UC03-R15, LA-EXP-UC03-R16, LA-EXP-UC04-R08, LA-EXP-DR58, LA-EXP-DR59, LA-EXP-DR60, LA-EXP-DR61]
  depends_on: [LA-EXP-C03, LA-EXP-C04, LA-EXP-C06, LA-EXP-C42, LA-EXP-C49, LA-EXP-C64, LA-EXP-C67]
---
The graph view drawn with React Flow over the one map (`LA-EXP-C64`): record nodes styled by stage with error and gap marks, domains drawn as hexagons (`LA-EXP-DR61`), folder-shaped group nodes, plain boxes and bars where the level of detail asks for them (`LA-EXP-DR60`), level parent lines and dashed, curved cross-links, the toolbar, filters, side bar, legend and minimap (a true overview of the map, `LA-EXP-UC03-R15`), and keyboard handling over the labeled boxes, column by column. Each node is drawn at its place and size in the map, its label at the map's text scale (`--node-scale`), centered, on one line (`LA-EXP-DR58`); nothing is ever laid out again, and the camera never resizes a label. A new focus, depth or pane size moves the camera (`LA-EXP-C49`): a glide of `setViewport` frames, the boxes it passes over drawn once as it starts. Free zoom and pan follow with a new level of detail once a frame, and a gesture takes over from a glide. The Layout switch (`LA-EXP-UC03-R16`, the `graphLayout` command) draws the Nested map (`LA-EXP-C67`) with the same camera, nodes, keyboard, spotlight, filters, minimap and side bar: each box at its place and size, its label in its header band, a parent drawn before its children, no parent lines or bars, and the keyboard in the tree's order.
