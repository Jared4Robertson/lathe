---
id: LA-EXP-C49
kind: component
title: Graph camera
parent: LA-EXP-LAY03
component_type: module
file: app/src/graph/camera.ts
links:
  satisfies: [LA-EXP-UC03-R09, LA-EXP-DR39, LA-EXP-DR40]
---
Re-centering moves the camera, not the picture. `anchorLayout` shifts a new layout so its focus keeps its place from the last picture; `fadeSets` says which records enter the picture and which leave; `frameFocus` gives the viewport that fits the whole picture, each box at its width and height in the icicle, with the focus as near the center as it allows. The graph page anchors each new layout, fades entering and leaving records, and glides the viewport there on the shared motion.
