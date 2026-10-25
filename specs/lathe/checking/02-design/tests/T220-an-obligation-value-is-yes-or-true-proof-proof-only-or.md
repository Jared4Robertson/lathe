---
id: LA-CHK-T220
kind: test
title: An obligation value is yes or true, proof (proof only) or anything else (not an obligation)
parent: LA-CHK
test_type: unit
run_by: lathe/test/patterns-like-s2.test.ts
links:
  proves: [LA-CHK-UC19-R04, LA-CHK-UC19-R06, LA-CHK-DR134, LA-CHK-DR136]
---
Expects `pattern_rule` to be a proof-only obligation and `pattern` to require nothing by default, and an extension that sets `pattern_rule` to `yes`, a kind to `Proof` and another to `maybe` to give a full obligation, a proof-only one and none.
