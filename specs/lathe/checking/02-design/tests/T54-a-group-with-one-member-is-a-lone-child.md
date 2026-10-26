---
id: LA-CHK-T54
kind: test
title: A group with one member is a lone-child warning on its parent, standard rules included
parent: LA-CHK
test_type: unit
run_by: lathe/test/groups-and-waivers.test.ts
links:
  proves: [LA-CHK-UC06-R07]
---
Expects a view whose Errors group holds one interaction requirement, a pattern whose Paging group holds one rule, and a standard whose Logging group holds one rule, each to get a `lone-child` warning naming the group and its member.
