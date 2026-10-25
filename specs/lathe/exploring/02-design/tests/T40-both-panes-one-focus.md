---
id: LA-EXP-T40
kind: test
title: Both panes follow one focus, Back moves both, and graph settings survive
parent: LA-EXP
test_type: acceptance
run_by: app/test/views.test.tsx
links:
  proves: [LA-EXP-UC05-R04, LA-EXP-DR09]
---
With the wiki and graph open, follows a child link in the wiki and expects the graph re-centered, clicks a node and expects the wiki and title to follow, goes Back and expects both to return, and expects depth 2 kept across pages and a trip to the Wiki view.
