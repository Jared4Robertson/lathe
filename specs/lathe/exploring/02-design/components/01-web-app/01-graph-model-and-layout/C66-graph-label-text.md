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
A box's label as part of the map. `labelLines` says what a box's label reads (its title and its kind and ID line), `marksOf` and `hasMarks` its problem badge; `titleWidth` and `metaWidth` estimate a line's width from a table of character widths for the label's faces, and `labelWidth` how wide a box must be for its label on one line at text scale 1, erring wide. `textScaleOf` is a box's text scale, its height over a leaf's, fixed by the map; `labelShown` decides whether a label is drawn at a zoom, its title 7 pixels or more on screen (`LA-EXP-DR60`).
