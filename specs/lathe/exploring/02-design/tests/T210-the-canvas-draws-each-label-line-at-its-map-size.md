---
id: LA-EXP-T210
kind: test
title: "Each label line is placed in map units at its face's size times its box's text scale, inside its box, and drawn at that size times the zoom"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/canvas.test.tsx
links:
  proves: [LA-EXP-DR58, LA-EXP-DR60, LA-PAT-APP-UX-R12]
---
For every box of the Tree, Nested and Voronoi maps of the test workspace, expects each label line's size to be its face's at text scale 1 times the box's text scale, and the whole line inside its box (a cell's inside its polygon), and every badge inside its box. On the page, expects each drawn line's font on screen to be its map size times the zoom, and a line under `TEXT_BAR_PX` drawn as a bar. Expects the canvas's measure to read each width once at its face's font, and the plain measure to be the same every time.
