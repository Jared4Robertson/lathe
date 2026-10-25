---
id: LA-TRC-T33
kind: test
title: The rules of a pattern nobody follows count in no domain and are not reported as outside one
parent: LA-TRC
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-TRC-UC04-R07, LA-TRC-UC04-R08, LA-TRC-DR10]
---
Expects no gap and no problem on an unfollowed pattern's rules, and no `obligation-outside-domain` warning for pattern rules.
