---
id: LA-BRW-T64
kind: test
title: The graph reads top to bottom by tier, and a trace reads left to right
parent: LA-BRW
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-BRW-UC20-R08]
---
Lays out a depth-2 graph and expects one row per tier in tier order, the ancestors above the focus and design records and tests below it; then lays out a trace and expects its columns from the requirement to the files.
