---
id: LA-EXP-C49
kind: component
title: Graph camera
parent: LA-EXP-LAY03
component_type: module
file: app/src/graph/camera.ts
links:
  satisfies: [LA-EXP-UC03-R09, LA-EXP-DR31, LA-EXP-DR59, LA-EXP-DR60, LA-EXP-DR63, LA-PAT-APP-UX-R11]
---
The camera over the one map. `frameOnMap` frames a focus and the levels the depth shows below it, the parent kept in a strip at the left edge (`LA-EXP-DR59`); `frameMap` frames the whole map; `fitBoxes` frames a trace. `zoomPath` is the smooth zoom and pan between two views (van Wijk and Nuij's, as d3-zoom takes), and `glideDuration` its length on the shared motion. `drawnFor` is the level of detail (`LA-EXP-DR60`): the boxes in view and big enough, each with its label, the bars for children too small, within the drawing budget; `mergeDrawn` joins what a glide passes over, so it is drawn once as the glide starts. The same camera serves the Nested layout (`LA-EXP-DR63`): `frameNested` frames the focus's box, and `drawnNested` draws the boxes in view and big enough, each with its label, a parent before its children.
