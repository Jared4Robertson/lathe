---
id: LA-CHK-T226
kind: test
title: A proof-only obligation counts as designed and built, has no satisfies gap and is never unsatisfied
parent: LA-CHK
test_type: unit
run_by: lathe/test/patterns-like-s2.test.ts
links:
  proves: [LA-CHK-UC19-R05, LA-CHK-DR135]
---
No component satisfies any pattern rule; expects designed and built equal to the total in every domain, no `satisfies` gaps and no `unsatisfied` warnings.
