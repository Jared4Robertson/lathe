---
id: LA-CHK-T242
kind: test
title: An obligation not yet proved, whose test is only planned, is unproved rather than proof-still-owed
parent: LA-CHK
test_type: unit
run_by: lathe/test/owed-and-silent.test.ts
links:
  proves: [LA-CHK-UC20-R01, LA-CHK-DR140]
---
Expects a requirement with only a planned test to get `unproved` and no `proof-still-owed`.
