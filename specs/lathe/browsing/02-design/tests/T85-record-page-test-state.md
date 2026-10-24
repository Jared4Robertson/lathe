---
id: LA-BRW-T85
kind: test
title: The record page shows a test's state, and says a planned test is not proof
parent: LA-BRW
test_type: component
run_by: app/test/obligations.test.tsx
links:
  proves: [LA-BRW-UC30-R04, LA-BRW-DR31]
---
Opens a planned, a manual and an automated test and expects a State row with each state, the raw `state` field not repeated, and a note on the planned test only.
