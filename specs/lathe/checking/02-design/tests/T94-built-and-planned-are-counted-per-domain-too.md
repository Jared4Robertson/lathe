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
Expects a domain whose component file exists to count the rule built, and a domain whose component file is missing and whose only test is planned to count it designed, not built, and planned.
