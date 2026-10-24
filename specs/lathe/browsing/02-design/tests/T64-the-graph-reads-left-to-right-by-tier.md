---
id: LA-BRW-T64
kind: test
title: The graph reads left to right by tier, and so does a trace
parent: LA-BRW
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-BRW-UC20-R08]
---
Lays out a depth-2 graph and expects one column per tier in tier order, the ancestors to the left of the focus and design records and tests to its right; then lays out a trace and expects its columns from the requirement to the files.
