---
id: LA-EXP-T15
kind: test
title: Filters hide kinds and relations and paths through them, never the focus
parent: LA-EXP
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-EXP-UC03-R05, LA-EXP-DR05]
---
Hides tests, then the satisfies relation, then views, and expects the hidden records and lines to go, nothing to be reached through them, and the focus to stay even when its own kind is hidden.
