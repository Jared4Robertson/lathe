---
id: LA-TRC-T19
kind: test
title: A use case following two patterns that share a setting is a warning
parent: LA-TRC
test_type: unit
run_by: lathe/test/capabilities.test.ts
links:
  proves: [LA-AUT-UC06-R07, LA-TRC-DR06]
---
Expects one `pattern-setting-clash` warning naming both patterns and the shared `audit` setting, and no missing setting for that use case.
