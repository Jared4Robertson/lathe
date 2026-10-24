---
id: LA-BRW-T122
kind: test
title: Split has a divider moved by keys, and a pane goes full screen until Escape
parent: LA-BRW
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-BRW-UC50-R03]
---
Moves the divider with the arrow and End keys, puts the graph pane full screen, expects focus on its button, presses Escape and expects the split back with focus on the full screen button.
