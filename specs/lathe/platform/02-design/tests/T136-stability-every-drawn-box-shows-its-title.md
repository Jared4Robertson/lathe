---
id: LA-PLT-T136
kind: test
title: "Stability: in each layout, focusing each of Lathe's domains at depth 2, framed and zoomed in, every drawn box shows its title text and its whole label inside it"
parent: LA-PLT
test_type: acceptance
run_by: app/stability/graph.spec.ts
links:
  proves: [LA-PAT-APP-UX-R12]
---
In the Tree layout at depth 2 and in the Nested and Voronoi layouts, focuses each of Lathe's five domains, framed and then zoomed in twice, and expects every drawn box in the canvas to show its title text and its whole label inside it, each line as drawn no wider than its place and inside its box, read from the canvas's drawn scene.
