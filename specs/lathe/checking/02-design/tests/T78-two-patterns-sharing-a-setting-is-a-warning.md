---
id: LA-CHK-T78
kind: test
title: "A use case following two patterns that share a setting is a warning"
parent: LA-CHK
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-CHK-UC10-R07, LA-CHK-DR44]
---
Expects one `pattern-setting-clash` warning naming both patterns and the shared `audit` setting, and no missing setting for that use case.
