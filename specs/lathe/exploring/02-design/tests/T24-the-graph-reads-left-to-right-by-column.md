---
id: LA-EXP-T24
kind: test
title: The graph reads left to right by column, and so does a trace
parent: LA-EXP
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-EXP-UC03-R08, LA-EXP-DR58]
---
Expects one x and one width per level of the map, levels left to right a gap apart, ancestors to the left of a record, and a trace's columns from the requirement to its files.
