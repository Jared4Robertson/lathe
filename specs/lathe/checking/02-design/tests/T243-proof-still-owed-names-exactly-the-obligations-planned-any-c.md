---
id: LA-CHK-T243
kind: test
title: proof-still-owed names exactly the obligations planned_any counts beyond planned, in every fixture
parent: LA-CHK
test_type: unit
run_by: lathe/test/owed-and-silent.test.ts
links:
  proves: [LA-CHK-DR140, LA-CHK-DR141]
---
Loads several fixtures and expects the obligations `proof-still-owed` names, per domain for pattern rules, to number exactly `planned_any` less `planned` summed over coverage.
