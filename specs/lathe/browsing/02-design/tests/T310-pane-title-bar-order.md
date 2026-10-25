---
id: LA-BRW-T310
kind: test
title: The title bar names its view at the left; the rightmost holds the view toggles, a divider, full screen and the inspector, with one on look
parent: LA-BRW
test_type: component
run_by: app/test/views.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R11, LA-BRW-UC50-R02]
---
Opens a record in the Wiki view and expects the bar's label to read "Wiki" and its actions, in order, to be the Wiki and Graph toggles (no Model on a use case), the divider, Full screen and the inspector toggle, with the pressed view and the shown inspector both `icon-button is-on`. Opens the graph and expects each pane's label and close button at its left, the wiki pane with only its full screen button, the graph pane with the toggles, focus on the Graph toggle that moved, and the title in the leftmost pane.
