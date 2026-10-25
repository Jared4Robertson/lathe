---
id: LA-TRC-T28
kind: test
title: Gaps name the pattern rule in each domain that lacks it
parent: LA-TRC
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-TRC-UC04-R02, LA-TRC-UC04-R05]
---
Expects no pattern rule gaps in the domain that proves both rules, and in another the exact `proves` gaps it still has, with no `satisfies` gaps since pattern rules need proof only.
