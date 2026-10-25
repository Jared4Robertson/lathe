---
id: LA-BRW-T310
kind: test
title: The title bar names its view at the left, then the view toggles, a divider and the layout actions at the right, with one on look
parent: LA-BRW
test_type: component
run_by: app/test/views.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R11, LA-BRW-UC50-R02]
---
Opens a record in the Wiki view and expects the bar's label to read "Wiki" and its actions, in order, to be the Wiki and Graph toggles, the divider, Open beside, Full screen and the inspector toggle, with the pressed view and the shown inspector both `icon-button is-on`. Opens the split and expects each pane's label and close button at its left, and focus on the graph pane's close button once Open beside has gone.
