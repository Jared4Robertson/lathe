---
id: LA-EXP-T175
kind: test
title: "Stability: a domain is drawn as a hexagon, its outline the polygon in every state"
parent: LA-EXP
test_type: acceptance
run_by: app/stability/graph.spec.ts
links:
  proves: [LA-EXP-UC03-R04, LA-EXP-DR61, LA-PAT-APP-UX-R08]
---
Opens the product's graph and expects the domain drawn as its hexagon, its outline a six-cornered polygon; hovered, the same polygon in the hover state; focused, still the polygon, drawn as the focus; and the product drawn as a rounded box, not a polygon.
