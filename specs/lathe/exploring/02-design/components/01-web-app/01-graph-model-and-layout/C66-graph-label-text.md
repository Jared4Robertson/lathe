---
id: LA-EXP-C66
kind: component
title: Graph label text
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/text.ts
links:
  satisfies: [LA-EXP-DR58, LA-EXP-DR60]
  depends_on: [LA-EXP-C03, LA-EXP-C04]
---
A box's label as part of the map. `labelLines` says what a box's label reads (its title and its kind and ID line), `marksOf` and `hasMarks` its problem badge; `titleWidth` and `metaWidth` estimate a line's width from a table of character widths for the label's faces, erring wide. `wrapText` breaks a text into lines on whole words, `wrapLabel` breaks a label for a leaf's width at text scale 1 (the same lines at every scale), `labelFor` caches it per node, and `labelHeight` is how tall its lines need a box to be; `isCentered` says whose label is centered. `textScaleOf` is a level's text scale, its width over a leaf's, fixed by the map; every drawn box shows its label (`LA-EXP-DR60`).
