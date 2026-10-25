---
id: LA-EXP-T30
kind: test
title: Groups take their own column between the parent and its children
parent: LA-EXP
test_type: unit
run_by: app/test/graph/groups.test.ts
links:
  proves: [LA-EXP-UC04-R05]
---
Lays out a group's neighborhood and expects the parent, the group, its members, a member's own group and its members from left to right, a member's group beside another member's ungrouped child, and every group one column after its parent and one before its members.
