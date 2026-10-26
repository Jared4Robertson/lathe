---
id: LA-PLT-T136
kind: test
title: "Stability: in each layout, focusing each of Lathe's domains at depth 2, every drawn box shows its title text"
parent: LA-PLT
test_type: acceptance
run_by: app/stability/graph.spec.ts
links:
  proves: [LA-PAT-APP-UX-R12]
---
In the Tree layout at depth 2 and in the Nested and Voronoi layouts, focuses each of Lathe's five domains and expects every drawn box in the canvas, other than a bar, to show visible title text.
