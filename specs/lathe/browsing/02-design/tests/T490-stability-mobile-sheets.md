---
id: LA-BRW-T490
kind: test
title: "Stability: the mobile sheets at 375 px move nothing behind them"
parent: LA-BRW
test_type: acceptance
state: planned
run_by: app/stability/pending.spec.ts
links:
  proves: [LA-BRW-UC117-R10]
---
Waits on brief 52 (mobile). Opens and closes the nav and inspector sheets at 375 px wide, and expects the page behind them not to move.
