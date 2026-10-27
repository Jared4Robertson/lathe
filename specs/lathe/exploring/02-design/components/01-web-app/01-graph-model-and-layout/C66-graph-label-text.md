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
A box's label as part of the map. `labelLines` says what a box's label reads (its title and its kind and ID line), `marksOf` and `hasMarks` its problem badge; `titleWidth` and `metaWidth` estimate a line's width from a table of character widths for the label's faces, erring wide. `wrapText` breaks a text into lines on whole words, `wrapLabel` and `linesIn` break a label for a box's width at text scale 1 (a box `w` wide at scale `s` wraps at `w / s`), keeping its kind's shape's room in the Tree (`LA-EXP-DR65`) and its marks' and badge's room, and `labelHeight` is how tall its lines (and its shape's room) need a box to be. `treeLabel` reads a node's label for the Tree map and a trace, `mapLabel` for the Nested and Voronoi maps (with room for its shape's mark), and `labelFor` caches a trace box's lines. `narrowestWidth` is the narrowest box a label fits without breaking a word, and `largestFit` the largest text scale, at most a box's size share, at which a label fits a room (`LA-EXP-DR58`). Every drawn box shows its label (`LA-EXP-DR60`).
