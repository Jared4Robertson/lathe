---
id: LA-CHK-T104
kind: test
title: The rules of a pattern nobody follows count in no domain and are not reported as outside one
parent: LA-CHK
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-CHK-UC11-R07, LA-CHK-UC11-R08, LA-CHK-DR53]
---
Expects no gap and no problem on an unfollowed pattern's rules, and no `obligation-outside-domain` warning for pattern rules.
