---
id: LA-CHK-T94
kind: test
title: Built and planned are counted per domain too
parent: LA-CHK
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-CHK-UC11-R03]
---
Expects a domain whose only test of a rule is planned to count it planned, not proved, with designed and built equal to the total since pattern rules need proof only.
