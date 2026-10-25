---
id: LA-EXP-T29
kind: test
title: "A group can be the focus: its parent and all its members are shown, and depth counts levels from it"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/groups.test.ts
links:
  proves: [LA-EXP-UC04-R03, LA-EXP-DR06]
---
Centers on the Capabilities folder and expects its stage and every member, the spine through it, the members' children and groups framed at depth 2 and their members at depth 3, nothing for a group that does not exist, an older kind group's address still working, and its `/<domain-id>/<stage>/<folder>` address both ways, the old `/graph/...` one leading there.
