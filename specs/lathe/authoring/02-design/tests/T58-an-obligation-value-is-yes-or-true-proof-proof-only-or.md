---
id: LA-AUT-T58
kind: test
title: An obligation value is yes or true, proof (proof only) or anything else (not an obligation)
parent: LA-AUT
test_type: unit
run_by: lathe/test/patterns-like-s2.test.ts
links:
  proves: [LA-TRC-UC07-R04, LA-TRC-UC07-R06, LA-AUT-DR33, LA-AUT-DR34]
---
Expects `pattern_rule` to be a proof-only obligation and `pattern` to require nothing by default, and an extension that sets `pattern_rule` to `yes`, a kind to `Proof` and another to `maybe` to give a full obligation, a proof-only one and none.
