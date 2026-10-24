---
id: LA-CHK-T05
kind: test
title: Coverage counts satisfied and proved requirements and lists the gaps
parent: LA-CHK
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-CHK-UC02-R01, LA-CHK-UC02-R02, LA-CHK-DR07]
---
Loads a fixture with known `satisfies` and `proves` links and expects the domain's coverage counts and gaps to match.
