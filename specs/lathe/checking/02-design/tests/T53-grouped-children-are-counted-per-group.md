---
id: LA-CHK-T53
kind: test
title: too-many-children counts grouped requirements per group, groups compared in any case
parent: LA-CHK
test_type: unit
run_by: lathe/test/groups-and-waivers.test.ts
links:
  proves: [LA-CHK-UC06-R06, LA-AUT-UC13-R06]
---
Loads a use case with one ungrouped requirement, five in Validation (one written in lower case with a trailing space) and three in Paging under a limit of 3, and expects one warning, naming Validation; a pattern whose rules fall into groups of two, one and two gets none.
