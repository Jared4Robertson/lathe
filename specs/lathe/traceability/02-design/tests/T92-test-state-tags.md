---
id: LA-TRC-T92
kind: test
title: The domain page tags each test with its state, and a planned test looks unfinished
parent: LA-TRC
test_type: component
run_by: app/test/obligations.test.tsx
links:
  proves: [LA-TRC-UC11-R04, LA-TRC-DR33]
---
Expects the tags automated (for a test with no state), manual and planned, and only the planned test's row and tag marked planned, with a title saying it does not count as proof.
