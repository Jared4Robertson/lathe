---
id: LA-EXP-T39
kind: test
title: The view toggles open and close panes, at least one stays open, and the open views are remembered and named in the link
parent: LA-EXP
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-EXP-UC05-R02, LA-EXP-DR10]
---
Opens a record with the wiki alone, expects no Split or Open beside, clicks Wiki and expects it to stay open with a tooltip that says why, opens the graph beside it and expects `?view=wiki,graph` and the panes in order, closes the wiki, opens another record and expects the graph again, then opens `?view=wiki,graph` and expects the wiki and the graph, remembered as `wiki,graph`, with the View toggles once, in the page bar.
