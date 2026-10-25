---
id: LA-PLT-T14
kind: test
title: Every gap between open panes moves by keys, is remembered and resets evenly, and a pane goes full screen until Escape
parent: LA-PLT
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-EXP-UC05-R03, LA-PLT-UC06-R01, LA-PLT-UC06-R02]
---
Moves the gap between the wiki and the graph with the arrow and End keys, expects each pane's weight in the grid with its least width and the weight remembered, double-clicks and expects an even share, puts the graph pane full screen, expects focus on its button, presses Escape and expects the panes back with focus on the full screen button.
