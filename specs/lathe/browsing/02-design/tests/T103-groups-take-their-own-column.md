---
id: LA-BRW-T103
kind: test
title: Groups take their own column between the parent and its children
parent: LA-BRW
test_type: unit
run_by: app/test/graph/groups.test.ts
links:
  proves: [LA-BRW-UC40-R05]
---
Lays out a group's neighbourhood and expects the parent, the group, its members, a member's own group and its members from left to right, a member's group beside another member's ungrouped child, and every group one column after its parent and one before its members.
