---
id: LA-BRW-T484
kind: test
title: "Stability: dragging each gap follows the pointer, and folding by drag moves nothing on the far side"
parent: LA-BRW
test_type: acceptance
run_by: app/stability/resize.spec.ts
links:
  proves: [LA-BRW-UC117-R05, LA-PAT-APP-UX-R08]
---
Drags the nav, pane and side bar gaps and folds the nav and the side bar by drag, and expects the boxes beside each gap never to jump back and the far side not to move.
