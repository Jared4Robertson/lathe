---
id: LA-PLT-T76
kind: test
title: "Nothing jumps, in the source: scroll boxes keep their gutter, bars have one height, counts are one text, canvases stay mounted"
parent: LA-PLT
test_type: unit
run_by: app/test/nothing-jumps.test.tsx
links:
  proves: [LA-PAT-APP-UX-R08, LA-PLT-DR18, LA-PLT-DR19, LA-EXP-DR43]
---
Reads `app/src/styles.css` and expects every vertical scroll box to set `scrollbar-gutter: stable` or hide its scrollbar, and the pane title above a canvas, the graph's trail and toolbar, and the Model view's caption and key to have a fixed block size or be one line. Renders the graph and expects its count to be one text after the depth, and its canvas to stay mounted when it re-centers. Reads the graph and Model view sources and expects what the graph connects to reach the host in a layout effect, and the ERD to be fitted before paint and to observe its size once. Moves to a record from outside the nav and expects the nav's domain row to stay closed and be marked, and opening it to open the branch down to the page. Reads `app/index.html` and `app/src/fonts.css` and expects no Google Fonts, the six latin files preloaded, every face `font-display: optional`, and each family's license beside its files.
