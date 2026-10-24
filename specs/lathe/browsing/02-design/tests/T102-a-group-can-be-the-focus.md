---
id: LA-BRW-T102
kind: test
title: A group can be the focus, showing its parent and all its members
parent: LA-BRW
test_type: unit
run_by: app/test/graph/groups.test.ts
links:
  proves: [LA-BRW-UC40-R03, LA-BRW-DR40]
---
Centres on a group and expects its parent and every member, the spine through it, that it cannot be folded while it is the focus, nothing for a group that does not exist, and its `/graph/<parent-id>/<kind>` address both ways.
