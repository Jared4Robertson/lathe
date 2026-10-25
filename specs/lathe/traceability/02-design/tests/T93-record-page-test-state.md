---
id: LA-TRC-T93
kind: test
title: The record page shows a test's state, and says a planned test is not proof
parent: LA-TRC
test_type: component
run_by: app/test/obligations.test.tsx
links:
  proves: [LA-TRC-UC11-R04, LA-TRC-DR33]
---
Opens a planned, a manual and an automated test and expects a State row with each state, the raw `state` field not repeated, and a note on the planned test only.
