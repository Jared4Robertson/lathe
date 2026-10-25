---
id: LA-EXP-T177
kind: test
title: "Stability: at depth 2 on a domain, every framed box whose title is 7 px or more on screen shows it in full on one line"
parent: LA-EXP
test_type: acceptance
run_by: app/stability/graph.spec.ts
links:
  proves: [LA-EXP-UC03-R01, LA-EXP-DR58, LA-EXP-DR60]
---
Opens the Exploring domain's graph at depth 2 and expects every box of the framed picture (the domain, its product at the left edge, its stages and their folders) that is wholly in the canvas and whose title is 7 pixels or more on screen to be labeled with its whole title, on one line and not cut off, and every framed box whose title would be under 7 pixels to draw no label.
