---
id: LA-PLT-T72
kind: test
title: "Stability: moving between records through the nav, a link, a graph click, Back and quick find keeps the frame still"
parent: LA-PLT
test_type: acceptance
run_by: app/stability/navigate.spec.ts
links:
  proves: [LA-PLT-UC09-R02, LA-PLT-DR18, LA-PAT-APP-UX-R08]
---
Moves between records each way and expects the frame not to move; from a page scrolled half-way, expects the new page never to be drawn at the old scroll, and Back to draw the page once, with the row that was at the top of the view back in its place.
