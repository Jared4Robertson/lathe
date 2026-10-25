---
id: LA-CHK-T16
kind: test
title: A domain_rule test proving only requirements, or an acceptance test proving only domain rules, is a warning
parent: LA-CHK
test_type: unit
run_by: lathe/test/structure.test.ts
links:
  proves: [LA-CHK-UC04-R04]
---
Expects `test-type-mismatch` on each of the three mismatched tests, one with its type in another letter case, naming what each proves.
