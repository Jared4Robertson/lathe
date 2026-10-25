---
id: LA-CHK-T233
kind: test
title: A step that fulfills a rule of a pattern only another use case follows is reported, as is an interaction requirement that fulfills it
parent: LA-CHK
test_type: unit
run_by: lathe/test/patterns-like-s2.test.ts
links:
  proves: [LA-CHK-UC19-R09, LA-CHK-DR138]
---
Expects `flow-step-fulfills-outside-flow` for a step fulfilling a rule of a pattern only another use case follows, and for one fulfilling an interaction requirement that fulfills that rule, naming the flow's use cases.
