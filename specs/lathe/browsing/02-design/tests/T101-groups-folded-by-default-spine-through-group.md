---
id: LA-BRW-T101
kind: test
title: Groups within the depth are open and those at its edge folded, the person can open or fold any, and the spine runs record, group, record
parent: LA-BRW
test_type: unit
run_by: app/test/graph/groups.test.ts
links:
  proves: [LA-BRW-UC40-R01, LA-BRW-UC40-R02, LA-BRW-DR41]
---
Walks a domain's neighborhood and expects every child kind as a folded group with no members; opens one and expects its members behind it on the spine; expects the focus's own group open and closable; expects cross-links to stay record to record and depths unchanged.
