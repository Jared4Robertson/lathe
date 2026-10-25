---
id: LA-PLT-T74
kind: test
title: "Stability: re-centering the graph at depth 1 to 3, changing depth and moving around the ERD keep the canvas still"
parent: LA-PLT
test_type: acceptance
run_by: app/stability/graph.spec.ts
links:
  proves: [LA-PLT-UC08-R06, LA-PLT-DR19, LA-EXP-DR43, LA-PAT-APP-UX-R08]
---
Re-centers twice at each depth, changes the depth, and goes from a domain's ERD to an aggregate's and an entity's and back, and expects the pane title, the graph header, the Model header and key and the canvas never to move or remount.
