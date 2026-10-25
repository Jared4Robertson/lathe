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
Opens the product's graph and expects the domain's computed clip-path a polygon, its fill clipped the same, no box-shadow; hovered, the same outline with the hover color on its edge; focused, still the polygon; and the product's box not clipped.
