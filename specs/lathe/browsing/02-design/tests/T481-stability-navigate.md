---
id: LA-BRW-T481
kind: test
title: "Stability: moving between records through the nav, a link, a graph click, Back and quick find keeps the frame still"
parent: LA-BRW
test_type: acceptance
run_by: app/stability/navigate.spec.ts
links:
  proves: [LA-BRW-UC117-R02, LA-BRW-DR240, LA-PAT-APP-UX-R08]
---
Moves between records each way and expects the frame not to move; from a page scrolled half-way, expects the new page never to be drawn at the old scroll, and Back to draw the page once.
