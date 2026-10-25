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
Centers on a group and expects its parent and every member, the spine through it, no other groups at depth 1 and the parent's and members' groups at depth 2, that it cannot be folded while it is the focus, nothing for a group that does not exist, and its `/<parent-id>/<kind>` address both ways, the old `/graph/<parent-id>/<kind>` leading there.
