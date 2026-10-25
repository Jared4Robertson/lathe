---
id: LA-BRW-T326
kind: test
title: Each tab keeps its own views, wiki scroll and graph settings, and switching its views keeps it open
parent: LA-BRW
test_type: component
run_by: app/test/record-tabs.test.tsx
links:
  proves: [LA-BRW-UC112-R05, LA-BRW-UC112-R02, LA-BRW-DR152, LA-BRW-DR153]
---
Opens the graph on a preview tab and expects it kept, sets the depth and scrolls the wiki; opens another page and expects it to start with the same views and depth at the top, then changes them; returns to the first tab and expects its two panes, depth and scroll back, and to the second for its wiki alone. A link naming other views to a page open in a tab shows the tab as it was and rewrites the address to its views.
