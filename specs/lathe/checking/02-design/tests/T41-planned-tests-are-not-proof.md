---
id: LA-CHK-T41
kind: test
title: Only automated and manual tests prove; a planned test makes an obligation planned
parent: LA-CHK
test_type: unit
run_by: lathe/test/coverage.test.ts
links:
  proves: [LA-CHK-UC07-R03, LA-CHK-DR21]
---
Loads a fixture with a test with no state, a manual test and a planned test, and expects only the first two to prove, the planned one to count as planned, and the `unproved` warning to say so.
