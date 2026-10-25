---
id: LA-BRW-T482
kind: test
title: "Stability: opening, closing and maximizing panes and the inspector moves only the panes"
parent: LA-BRW
test_type: acceptance
run_by: app/stability/panes.spec.ts
links:
  proves: [LA-BRW-UC117-R03, LA-BRW-DR240, LA-BRW-DR242, LA-PAT-APP-CODE-R17]
---
Opens and closes the Graph and Model panes (Ctrl+2, Ctrl+4, Ctrl+1), full screen (Ctrl+3, Escape) and the inspector, and expects the nav and inspector to stay, open panes not to be drawn anew, and a canvas to appear already fitted.
