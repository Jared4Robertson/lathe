---
id: LA-PLT-T81
kind: test
title: "Stability: the mobile sheets at 375 px move nothing behind them"
parent: LA-PLT
test_type: acceptance
run_by: app/stability/theme-and-mobile.spec.ts
links:
  proves: [LA-PLT-UC09-R10, LA-PAT-APP-UX-R08]
---
At 375 px wide with touch, opens and closes the nav drawer, the quick find sheet and the side bar sheet, and expects the top bar, the page and its title behind them not to move.
