---
id: LA-CHK-T319
kind: test
title: Support never counts as proof, automated or planned
parent: LA-CHK
test_type: unit
run_by: lathe/test/trial-4-fixes.test.ts
links:
  proves: [LA-CHK-UC27-R01, LA-CHK-DR203]
---
Expects a requirement that an automated check only supports to stay unproved, and a planned check that supports a proved requirement to count in neither `planned` nor `planned_any`, and to raise no `proof-still-owed`.
