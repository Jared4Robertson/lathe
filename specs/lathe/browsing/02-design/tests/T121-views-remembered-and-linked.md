---
id: LA-BRW-T121
kind: test
title: The header toggles three views, remembered, with the view in the link
parent: LA-BRW
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-BRW-UC50-R02, LA-BRW-DR52]
---
Switches a record page from Wiki to Graph, expects the address and the panes to follow, opens another record and expects Graph again, then opens a link with `?view=split` and expects Split, remembered.
