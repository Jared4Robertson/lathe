---
id: LA-BRW-T485
kind: test
title: "Stability: re-centering the graph at depth 1 to 3, changing depth and moving around the ERD keep the canvas still"
parent: LA-BRW
test_type: acceptance
run_by: app/stability/graph.spec.ts
links:
  proves: [LA-BRW-UC117-R06, LA-BRW-DR241, LA-BRW-DR242, LA-PAT-APP-CODE-R17]
---
Re-centers twice at each depth, changes the depth, and goes from a domain's ERD to an aggregate's and an entity's and back, and expects the pane title, the graph header, the Model header and key and the canvas never to move or remount.
