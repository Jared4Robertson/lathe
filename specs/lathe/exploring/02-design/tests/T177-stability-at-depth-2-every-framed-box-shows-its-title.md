---
id: LA-EXP-T177
kind: test
title: "Stability: at depth 2 on a domain, every framed box at least 40 px tall on screen shows its title"
parent: LA-EXP
test_type: acceptance
run_by: app/stability/graph.spec.ts
links:
  proves: [LA-EXP-UC03-R01, LA-EXP-DR60]
---
Opens the Exploring domain's graph at depth 2 and expects every box of the framed picture (the domain, its product, its stages and their folders) that is wholly in the canvas and at least 40 pixels tall on screen to show its title.
