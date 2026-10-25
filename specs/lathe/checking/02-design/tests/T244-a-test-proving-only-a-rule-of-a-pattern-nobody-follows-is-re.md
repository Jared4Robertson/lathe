---
id: LA-CHK-T244
kind: test
title: A test proving only a rule of a pattern nobody follows is reported
parent: LA-CHK
test_type: unit
run_by: lathe/test/owed-and-silent.test.ts
links:
  proves: [LA-CHK-UC20-R02, LA-CHK-DR142]
---
Expects `proof-counts-nowhere` on a test that proves only a rule of a pattern no use case follows, saying so.
