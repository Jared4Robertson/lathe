---
id: LA-BRW-T50
kind: test
title: At depth 1 the graph shows every record one step away, both ways
parent: LA-BRW
test_type: unit
run_by: app/test/graph/model.test.ts
links:
  proves: [LA-BRW-UC20-R01]
---
Builds a small workspace and expects the depth-1 neighborhood of a requirement, a component and an aggregate to hold exactly the records one link or parent step away, with every link between them.
