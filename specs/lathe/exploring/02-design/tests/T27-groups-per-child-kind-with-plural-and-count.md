---
id: LA-EXP-T27
kind: test
title: A record with several kinds of child has a labeled, counted group per kind
parent: LA-EXP
test_type: unit
run_by: app/test/graph/groups.test.ts
links:
  proves: [LA-EXP-UC04-R01, LA-EXP-DR06, LA-EXP-DR07]
---
Checks which records are grouped (only those with more than one kind of child, however many of one kind), the groups' labels such as "Requirements (6)", their members, and that a group's ID is its parent and kind and names no record.
