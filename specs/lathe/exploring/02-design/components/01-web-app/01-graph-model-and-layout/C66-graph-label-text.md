---
id: LA-EXP-C66
kind: component
title: Graph label text
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/text.ts
links:
  satisfies: [LA-EXP-DR58, LA-EXP-DR60, LA-EXP-DR62, LA-EXP-DR65]
  depends_on: [LA-EXP-C03, LA-EXP-C04]
---
A box's label as part of the map. `labelLines` says what a box's label reads (its title and its kind and ID line), `marksOf` and `hasMarks` its problem badge; `titleWidth` and `metaWidth` measure a line's width with the text measure the maps are laid out with (`setTextMeasure`, `textMeasure`): the canvas's on the loaded faces (`LA-EXP-C82`), or `PLAIN_MEASURE` where there is no canvas (the unit tests). `wrapText` breaks a text into lines on whole words, `wrapLabel` breaks a label for a leaf's width at text scale 1 (the same lines at every scale), `labelFor` caches it per node and measure, keeping its kind's shape's room (`LA-EXP-DR65`) and a mark's, and `labelHeight` is how tall its lines (and its shape's room) need a box to be; `isCentered` says whose label is centered. `textScaleOf` is a Tree level's text scale, its width over a leaf's, fixed by the map. For the Nested and Voronoi maps, `mapLabel` reads a node's `MapLabel` (with room for its shape's mark), and `narrowestWidth`, `wordsFit` and `linesIn` size and wrap it at text scale 1. Every drawn box shows its label (`LA-EXP-DR60`).
