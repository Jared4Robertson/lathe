---
id: LA-CHK-T103
kind: test
title: A pattern that no use case follows is a warning
parent: LA-CHK
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-CHK-UC11-R07, LA-CHK-DR53]
---
Expects a `pattern-not-followed` warning on a pattern with rules (saying how many are not counted) and on one with none, and none in a workspace where every pattern is followed.
