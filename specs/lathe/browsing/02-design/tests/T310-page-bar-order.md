---
id: LA-BRW-T310
kind: test
title: The page bar holds the tabs, then the view toggles, a divider and the inspector toggle; each pane header names its view and holds its close and full screen buttons, with one on look
parent: LA-BRW
test_type: component
run_by: app/test/views.test.tsx
links:
  proves: [LA-PAT-APP-UX-R03, LA-BRW-UC50-R02]
---
Opens a record in the Wiki view and expects the page bar to hold the active tab for the record at its left and, in order, the Wiki and Graph toggles (no Model on a use case), the divider and the inspector toggle, with the pressed view and the shown inspector both `icon-button is-on`, and the wiki pane's header to name its view and hold only Full screen. Opens the graph and expects each pane's header to hold its close and full screen buttons, the page bar unchanged, no tab strip in a pane, focus kept on the Graph toggle, and the title in the leftmost pane.
