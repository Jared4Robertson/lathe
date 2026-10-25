---
id: LA-BRW-T65
kind: test
title: Links within a column never stop the layout in columns
parent: LA-BRW
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-BRW-UC20-R08]
---
Adds two aggregates that relate to each other in a ring and expects them in one column, both links drawn, and the graph still laid out in columns.
