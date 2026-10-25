---
id: LA-BRW-T488
kind: test
title: "Nothing jumps, in the source: scroll boxes keep their gutter, bars have one height, counts are one text, canvases stay mounted"
parent: LA-BRW
test_type: unit
run_by: app/test/nothing-jumps.test.tsx
links:
  proves: [LA-PAT-APP-UX-R08, LA-BRW-DR240, LA-BRW-DR241, LA-BRW-DR242]
---
Reads `app/src/styles.css` and expects every vertical scroll box to set `scrollbar-gutter: stable` (but for a listed few that wait on phase 2 of brief 53, a list that may only shrink), and the pane title above a canvas, the graph's trail and toolbar, and the Model view's caption and key to have a fixed block size or be one line. Renders the graph and expects its count to be one text after the depth, and its canvas to stay mounted when it re-centers. Reads the graph and Model view sources and expects what the graph connects to reach the host in a layout effect, and the ERD to be fitted before paint and to observe its size once.
