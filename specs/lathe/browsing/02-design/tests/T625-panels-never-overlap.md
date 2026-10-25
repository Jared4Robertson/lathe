---
id: LA-BRW-T625
kind: test
title: At 1024 px with three panes and the side bar open, no two panels overlap
parent: LA-BRW
test_type: acceptance
run_by: app/stability/panes.spec.ts
links:
  proves: [LA-PAT-APP-UX-R02]
---
Opens an aggregate with the Wiki, Graph and Model panes and the side bar in a 1024 by 700 window, too narrow for every pane's least width beside the side bar, and expects the nav, each pane and the side bar to sit left to right, each starting where the one before ends, with the side bar inside the window. Before the fix, the Graph pane ran under the side bar.
