---
id: LA-PLT-T73
kind: test
title: "Stability: opening, closing and maximizing panes and the side bar moves only the panes"
parent: LA-PLT
test_type: acceptance
run_by: app/stability/panes.spec.ts
links:
  proves: [LA-PLT-UC09-R03, LA-PLT-DR18, LA-EXP-DR43, LA-PAT-APP-UX-R08]
---
Opens and closes the Graph and Model panes (Ctrl+2, Ctrl+4, Ctrl+1), full screen (Ctrl+3, Escape) and the side bar, and expects the nav and side bar to stay, open panes not to be drawn anew, and a canvas to appear already fitted.
