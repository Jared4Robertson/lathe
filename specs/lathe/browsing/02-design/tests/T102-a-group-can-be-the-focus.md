---
id: LA-BRW-T102
kind: test
title: "A group can be the focus: its parent and all its members are shown, and depth counts levels from it"
parent: LA-BRW
test_type: unit
run_by: app/test/graph/groups.test.ts
links:
  proves: [LA-BRW-UC40-R03, LA-BRW-DR40]
---
Centers on the Capabilities folder and expects its stage and every member, the spine through it, the next level out as context at depth 1 and in focus at depth 2, that it cannot be folded while it is the focus, nothing for a group that does not exist, an older kind group's address still working, and its `/<domain-id>/<stage>/<folder>` address both ways, the old `/graph/...` one leading there.
