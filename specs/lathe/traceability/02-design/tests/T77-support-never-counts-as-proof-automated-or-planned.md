---
id: LA-TRC-T77
kind: test
title: Support never counts as proof, automated or planned
parent: LA-TRC
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-TRC-UC03-R04, LA-TRC-DR28]
---
Expects a requirement that an automated check only supports to stay unproved, and a planned check that supports a proved requirement to count in neither `planned` nor `planned_any`, and to raise no `proof-still-owed`.
