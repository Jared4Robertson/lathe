---
id: LA-BRW-T489
kind: test
title: "Stability: switching theme moves nothing"
parent: LA-BRW
test_type: acceptance
state: planned
run_by: app/stability/pending.spec.ts
links:
  proves: [LA-BRW-UC117-R09]
---
Waits on brief 49 (themes). Switches between the built-in themes on a record page with the graph open, and expects no layout shift at all.
