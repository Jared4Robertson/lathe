---
id: LA-BRW-T81
kind: test
title: Without counts per obligation kind, coverage falls back to requirements and domain rules
parent: LA-BRW
test_type: component
run_by: app/test/obligations.test.tsx
links:
  proves: [LA-BRW-UC30-R01, LA-BRW-DR30]
---
Serves coverage with no `obligations` and expects requirement and domain rule groups from the older fields, "not yet measured" for unreported built counts, and no planned bar.
