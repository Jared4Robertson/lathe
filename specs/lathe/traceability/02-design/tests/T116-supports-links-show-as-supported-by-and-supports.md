---
id: LA-TRC-T116
kind: test
title: Supports links show as Supported by on the obligation and Supports on the test, never as proof
parent: LA-TRC
test_type: acceptance
run_by: app/test/traceability.test.tsx
links:
  proves: [LA-TRC-UC14-R01, LA-TRC-UC14-R04]
---
Expects a domain rule that a test supports to list the test under Supported by and not under Proved by, and the test to list the rule under Supports.
