---
id: LA-TRC-T32
kind: test
title: A pattern that no use case follows is a warning
parent: LA-TRC
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-TRC-UC04-R07, LA-TRC-DR10]
---
Expects a `pattern-not-followed` warning on a pattern with rules (saying how many are not counted) and on one with none, and none in a workspace where every pattern is followed.
