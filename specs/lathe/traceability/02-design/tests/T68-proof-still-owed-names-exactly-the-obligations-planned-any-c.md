---
id: LA-TRC-T68
kind: test
title: proof-still-owed names exactly the obligations planned_any counts beyond planned, in every fixture
parent: LA-TRC
test_type: unit
run_by: lathe/test/owed-and-silent.test.ts
links:
  proves: [LA-TRC-DR24, LA-TRC-DR25]
---
Loads several fixtures and expects the obligations `proof-still-owed` names, per domain for pattern rules, to number exactly `planned_any` less `planned` summed over coverage.
