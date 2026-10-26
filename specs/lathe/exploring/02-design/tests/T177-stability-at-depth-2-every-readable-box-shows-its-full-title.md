---
id: LA-EXP-T177
kind: test
title: "Stability: at depth 2 on a domain, the domain, its stages and their folders are framed in the canvas, each showing its full title wrapped on whole words"
parent: LA-EXP
test_type: acceptance
run_by: app/stability/graph.spec.ts
links:
  proves: [LA-EXP-UC03-R01, LA-EXP-DR58, LA-EXP-DR60]
---
Opens the Exploring domain's graph at depth 2 and expects the domain, every stage and at least half the folders wholly in the canvas, and every framed box (the domain, its product at the left edge, its stages and their folders) labeled with its whole title, each of its lines fitting and every line but the last ending after a space or a hyphen.
