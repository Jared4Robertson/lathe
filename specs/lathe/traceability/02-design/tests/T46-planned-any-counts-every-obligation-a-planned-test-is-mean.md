---
id: LA-TRC-T46
kind: test
title: planned_any counts every obligation a planned test is meant to prove, proved or not
parent: LA-TRC
test_type: unit
run_by: lathe/test/owed-proof.test.ts
links:
  proves: [LA-TRC-UC06-R01, LA-TRC-DR16]
---
Loads `owed-proof`, where requirements are proved by automated and manual tests with planned tests beside them, one has only planned tests and one only automated tests, and expects `planned_any` 3 of 4 beside `planned` 1.
