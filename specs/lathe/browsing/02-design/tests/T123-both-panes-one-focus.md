---
id: LA-BRW-T123
kind: test
title: Both panes follow one focus, Back moves both, and graph settings survive
parent: LA-BRW
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-BRW-UC50-R04, LA-BRW-DR51]
---
In Split, follows a child link in the wiki and expects the graph re-centred, clicks a node and expects the wiki and title to follow, goes Back and expects both to return, and expects depth 2 kept across pages and a trip to the Wiki view.
