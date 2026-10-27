---
id: LA-EXP-T184
kind: test
title: "Stability: a label keeps its size in the map when the focus changes and the camera zooms"
parent: LA-EXP
test_type: domain_rule
run_by: app/stability/graph.spec.ts
links:
  proves: [LA-EXP-DR58, LA-EXP-DR60]
---
Opens the Exploring domain's graph, reads its Design stage's title font size in the drawn scene (its font on screen over the zoom) and its lines, focuses the stage and then zooms in, and expects the font size in map units and the lines unchanged each time, and the title's size on screen to change only with the camera's zoom.
