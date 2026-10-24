---
id: LA-CHK-T98
kind: test
title: Gaps name the pattern rule in each domain that lacks it
parent: LA-CHK
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-CHK-UC11-R02, LA-CHK-UC11-R05]
---
Expects no pattern rule gaps in the domain that proves both rules, and in another the exact satisfies and proves gaps it still has.
