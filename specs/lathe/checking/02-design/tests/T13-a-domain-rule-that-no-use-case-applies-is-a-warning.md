---
id: LA-CHK-T13
kind: test
title: A domain rule that no use case applies is a warning
parent: LA-CHK
test_type: unit
run_by: lathe/test/structure.test.ts
links:
  proves: [LA-CHK-UC04-R01]
---
Loads a domain with one rule a use case applies and one nothing applies, and expects `rule-not-applied` on the second only.
