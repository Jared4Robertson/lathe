---
id: LA-PLT-T137
kind: test
title: "Performance: zoom and pan on Lathe's map are measured frame by frame in each layout"
parent: LA-PLT
test_type: acceptance
run_by: app/perf/app.perf.ts
links:
  proves: [LA-PAT-APP-UX-R11]
---
On Lathe's product in the Tree, Nested and Voronoi layouts, zooms the canvas in and out with the wheel about the pointer (twenty steps each way) and pans it with a drag, and prints for each the longest frame, the main-thread work and how many frames took over 20 ms. It is measured, not held to a budget: the re-center budgets (`LA-PLT-T93`) hold the graph's motion.
