---
id: LA-BRW-T495
kind: test
title: Supports links show as Supported by on the obligation and Supports on the test, never as proof
parent: LA-BRW
test_type: acceptance
run_by: app/test/traceability.test.tsx
links:
  proves: [LA-BRW-UC118-R01, LA-BRW-UC118-R04]
---
Expects a domain rule that a test supports to list the test under Supported by and not under Proved by, and the test to list the rule under Supports.
