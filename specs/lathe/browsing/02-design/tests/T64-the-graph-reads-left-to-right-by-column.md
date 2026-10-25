---
id: LA-BRW-T64
kind: test
title: The graph reads left to right by column, and so does a trace
parent: LA-BRW
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-BRW-UC20-R08]
---
Lays out a depth-2 graph and expects one x position per column in column order and the ancestors to the left of the focus; at depth 1 expects what satisfies, fulfills and proves the requirement to its right; then lays out a trace and expects its columns from the requirement to the files.
