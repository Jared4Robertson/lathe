---
id: LA-BRW-T122
kind: test
title: Every gap between open panes moves by keys, is remembered and resets evenly, and a pane goes full screen until Escape
parent: LA-BRW
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-BRW-UC50-R03, LA-BRW-UC111-R01, LA-BRW-UC111-R02]
---
Moves the gap between the wiki and the graph with the arrow and End keys, expects each pane's weight in the grid with its least width and the weight remembered, double-clicks and expects an even share, puts the graph pane full screen, expects focus on its button, presses Escape and expects the panes back with focus on the full screen button.
